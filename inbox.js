const PAGE_SIZE = 5;
const urlParams = new URLSearchParams(window.location.search);
const user = urlParams.get('user');
const offset = parseInt(urlParams.get('offset')) || 0;
document.getElementById('title').innerHTML = user + "@idont.date";

if (offset > 0) {
    const prev = document.getElementById('prev');
    prev.onclick = () => {
        window.location.href = './inbox.html?user=' + user + '&offset=' + Math.max(0, offset - PAGE_SIZE);
    }
    prev.disabled = false;
}
document.getElementById('current_page').innerHTML = "page " + Math.floor(offset / PAGE_SIZE + 1);

const req = new XMLHttpRequest();
const url = 'https://spin-psarna.turso.io';
req.open("POST", url);
const readonly_token = 'sreyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJpYXQiOjE3NzU1NDU4ODEsImlkIjoiNzIyY2IyYTEtY2M3MC0xMWVkLWFkM2MtOGVhNWEwNjcyYmM2IiwicmlkIjoiODEyNTAwY2QtNmY0ZS00Y2IzLWI3MDktZjQxMTQ5MDA3MmJmIn0.HGbjj8_pENDvvb9gbpziS-Xqr25FkQkSBPB3Sk50a5CznCMkw8BoE29o-3koUGww_guOfZ5s0MKkiR6i4wv3CQ';
req.setRequestHeader('Authorization', 'Bearer ' + readonly_token.slice(2));

const req_start = Date.now();
req.send(JSON.stringify({ statements: [{ q: "SELECT date, sender, recipients, data FROM mail WHERE lower(recipients) = ? ORDER BY ROWID DESC LIMIT ? OFFSET ?", params: ["<" + user + "@idont.date>", PAGE_SIZE, offset] }] }));

// Some of these rules are heavily inspired by https://www.npmjs.com/package/quoted-printable:
// FIXME: proper sanitizer should read the encoding from the headers or deduce it,
// and then apply it accordingly.

function sanitize(s) {
    return s
        .replaceAll('=E2=80=8A', '')
        .replaceAll('=E2=80=8B', '')
        .replaceAll('=E2=80=8C', '')
        .replaceAll('=C2=A0', '<br>')
        .replaceAll('=E2=80=99', "'")
        .replaceAll(/[\t\x20]$/gm, '')
        // Remove hard line breaks preceded by `=`. Proper `Quoted-Printable`-
        // encoded data only contains CRLF line  endings, but for compatibility
        // reasons we support separate CR and LF too.
        .replaceAll(/=(?:\r\n?|\n|$)/g, '')
        // Decode escape sequences of the form `=XX` where `XX` is any
        // combination of two hexidecimal digits. For optimal compatibility,
        // lowercase hexadecimal digits are supported as well. See
        // https://tools.ietf.org/html/rfc2045#section-6.7, note 1.
        .replaceAll(/=([a-fA-F0-9]{2})/g, function (_match, target) {
            var codePoint = parseInt(target, 16);
            return String.fromCharCode(codePoint);
        });
}

// Check if a string is likely base64 encoded
function isBase64(str, minLength = 50) {
    // Remove whitespace and check if it's a valid base64 string
    const cleanStr = str.replace(/\s/g, '');
    
    // Base64 should be divisible by 4 after padding
    if (cleanStr.length % 4 !== 0) return false;
    
    // Check if it contains only valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(cleanStr) && cleanStr.length >= minLength;
}

// Decode base64 string
function decodeBase64(str) {
    try {
        // Clean up the base64 string
        const cleanStr = str.replace(/\s/g, '');
        
        // Use built-in atob function
        const decoded = atob(cleanStr);
        
        // Try to convert to readable text, handling different encodings
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i);
            if (charCode < 128) {
                result += decoded.charAt(i);
            } else {
                // For non-ASCII, try to preserve as much as possible
                result += String.fromCharCode(charCode);
            }
        }
        
        return result;
    } catch (e) {
        // If decoding fails, return original string
        return str;
    }
}

// Decode potentially base64 encoded subject/from fields
function decodeHeaderField(field) {
    if (!field) return field;
    
    // Handle standard RFC 2047 encoded-word format: =?charset?encoding?encoded-text?=
    const rfc2047Regex = /=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g;
    let decoded = field.replace(rfc2047Regex, (match, charset, encoding, encodedText) => {
        try {
            if (encoding.toLowerCase() === 'b') {
                // Base64 encoding
                return decodeBase64(encodedText);
            } else if (encoding.toLowerCase() === 'q') {
                // Quoted-printable encoding
                return sanitize(encodedText);
            }
        } catch (e) {
            // If decoding fails, return original
            return match;
        }
        return match;
    });
    
    // Also check if the entire field (minus any trailing ?=) looks like base64
    let cleanField = field.replace(/\?=$/, '').trim();
    if (isBase64(cleanField, 8)) { // Lower threshold for headers
        try {
            const decodedField = decodeBase64(cleanField);
            // Only use decoded version if it contains readable characters
            if (decodedField.match(/[a-zA-Z\s]/)) {
                decoded = decodedField;
            }
        } catch (e) {
            // If decoding fails, keep original
        }
    }
    
    return decoded;
}

// Process email content to handle both quoted-printable and base64 encoding
function processEmailContent(content) {
    // Split content into blocks to handle multiple content sections
    const blocks = content.split(/(?=Content-Type:|Content-Transfer-Encoding:)/i);
    let processedContent = '';
    
    for (let block of blocks) {
        if (!block.trim()) continue;
        
        // Check for Content-Transfer-Encoding header
        const encodingMatch = block.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
        
        if (encodingMatch) {
            const encoding = encodingMatch[1].trim().toLowerCase();
            
            if (encoding === 'base64') {
                // Find the actual base64 content (usually after headers)
                const lines = block.split(/\r?\n/);
                let contentStarted = false;
                let base64Content = '';
                
                for (let line of lines) {
                    // Skip headers
                    if (!contentStarted) {
                        if (line.trim() === '' || line.match(/^[A-Za-z0-9+/=\s]+$/)) {
                            contentStarted = true;
                        }
                        if (!contentStarted) continue;
                    }
                    
                    // Collect base64 content
                    if (isBase64(line)) {
                        base64Content += line;
                    }
                }
                
                if (base64Content) {
                    const decoded = decodeBase64(base64Content);
                    // Check if decoded content looks like text or HTML
                    if (decoded.includes('<') || decoded.match(/[a-zA-Z]/)) {
                        processedContent += decoded;
                    } else {
                        // If it's binary data (like images), show a placeholder
                        processedContent += '[Binary content - ' + (encodingMatch[0].match(/name=([^\s;]+)/i)?.[1] || 'attachment') + ']<br>';
                    }
                } else {
                    processedContent += sanitize(block);
                }
            } else if (encoding === 'quoted-printable') {
                processedContent += sanitize(block);
            } else {
                // For other encodings or no encoding, just sanitize
                processedContent += sanitize(block);
            }
        } else {
            // No encoding specified, check if it looks like base64 anyway
            if (isBase64(block)) {
                const decoded = decodeBase64(block);
                processedContent += decoded;
            } else {
                processedContent += sanitize(block);
            }
        }
    }
    
    return processedContent || sanitize(content);
}

function parse(email) {
    const subject_position = email.indexOf('Subject: ') || email.indexOf('SUBJECT: ');
    let subject = email.substring(subject_position + 9, email.indexOf('\r\n', subject_position));
    if (subject.toLowerCase().startsWith("=?utf-8?")) {
        subject = decodeHeaderField(subject);
    } else {
        subject = sanitize(subject);

    }

    const from_position = email.indexOf('From: ') || email.indexOf('FROM: ');
    let from = email.substring(from_position + 6, email.indexOf('\r\n', from_position))
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    if (from.toLowerCase().startsWith("=?utf-8?")) {
        from = sanitize(from.substring(10));
    } else {
        // Try to decode base64 from fields
        from = decodeHeaderField(from)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    const body_position = email.indexOf('<body') || email.indexOf('<BODY') || email.indexOf('\r\n\r\n');
    const rawBody = email.substring(body_position);
    
    // Process the body content to handle base64 and other encodings
    const body = processEmailContent(rawBody);

    return [from, subject, body];
}

function createTable(data) {
    const table = document.createElement('table');
    table.className = 'table-hover';
    table.style.border = '1px solid';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    const th1 = document.createElement('th');
    const th2 = document.createElement('th');
    const th3 = document.createElement('th');
    th1.style.border = th2.style.border = th3.style.border = '1px solid';
    th1.innerHTML = "from";
    th2.innerHTML = "subject";
    th3.innerHTML = "date";
    tr.appendChild(th1);
    tr.appendChild(th2);
    tr.appendChild(th3);
    thead.appendChild(tr);
    table.appendChild(thead);
    for (const row of data.rows) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        const td2 = document.createElement('td');
        const td3 = document.createElement('td');
        td1.style.border = td2.style.border = td3.style.border = '1px solid';
        const [from, subject, body] = parse(row[3]);
        td1.innerHTML = from || row[1].slice(1, -1);
        td2.innerHTML = subject || "[no subject]";
        td3.innerHTML = new Date(row[0]).toLocaleString();
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.onclick = () => {
            document.getElementById('datapanel').innerHTML = body;
        }
        tbody.appendChild(tr);
    }
    if (data.rows.length == 0) {
        const tr = document.createElement('tr');
        const div = document.createElement('div');
        div.style.textAlign = 'center';
        const h = document.createElement('h4');
        h.innerHTML = "No e-mails for " + user + "@idont.date yet! <br> &#8635; refresh";
        h.onclick = _ => window.location.reload();
        div.appendChild(h);
        tr.appendChild(div);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

req.onload = (e) => {
    if (req.status != 200) {
        const msg = document.createElement('p');
        msg.style.textAlign = 'center';
        msg.innerText = "Error: " + req.responseText;
        document.getElementById('inbox_table').appendChild(msg);
        return;
    }
    const response = JSON.parse(req.responseText);
    document.getElementById('inbox_table').appendChild(createTable(response[0].results))
    if (response[0].results.rows.length >= PAGE_SIZE) {
        const next = document.getElementById('next');
        next.onclick = () => {
            window.location.href = './inbox.html?user=' + user + '&offset=' + (offset + PAGE_SIZE);
        };
        next.disabled = false;
    }
    const req_end = Date.now();
    const footer = document.createElement('p');
    footer.style.textAlign = 'center';
    footer.innerHTML = `<small><i>This inbox was fetched for you straight from the edge in blazing ${req_end - req_start} ms</i></small>`;
    document.getElementById('inbox_table').appendChild(footer);
}
