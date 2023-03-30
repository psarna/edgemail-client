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
function _0x11e6() { var _0x2c9f0d = ['1003093NkzhkS', '18XsQUQq', '2qFIiPt', '460997IHEnik', '1582009HwZhNs', '65xaAQkH', '20ezKShE', '23424RLlkTt', 'setRequestHeader', '3475825CFJvMy', '417vSBffS', '136uugIFq', '11348UGcNih', 'Bearer\x20eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2ODAxNjU2MjksImlkIjoiNzIyY2IyYTEtY2M3MC0xMWVkLWFkM2MtOGVhNWEwNjcyYmM2In0.DGf7AACRX1fF1q_R06GRmZtVZYRgS53rKw12MaytmO3SpItIlnWK6WC2zBpkug_g903V4wwUPrqOTXT62zacAg', '236358QPXvGc']; _0x11e6 = function () { return _0x2c9f0d; }; return _0x11e6(); } function _0x45a0(_0x291977, _0x4a74ca) { var _0x11e681 = _0x11e6(); return _0x45a0 = function (_0x45a0b0, _0x1d6b21) { _0x45a0b0 = _0x45a0b0 - 0x1c9; var _0x4db815 = _0x11e681[_0x45a0b0]; return _0x4db815; }, _0x45a0(_0x291977, _0x4a74ca); } var _0x3c1192 = _0x45a0; (function (_0x18febe, _0x3bc470) { var _0x249a1b = _0x45a0, _0xd84c2c = _0x18febe(); while (!![]) { try { var _0x4f6acb = -parseInt(_0x249a1b(0x1cc)) / 0x1 * (parseInt(_0x249a1b(0x1cb)) / 0x2) + -parseInt(_0x249a1b(0x1d3)) / 0x3 * (-parseInt(_0x249a1b(0x1d5)) / 0x4) + parseInt(_0x249a1b(0x1d2)) / 0x5 + -parseInt(_0x249a1b(0x1ca)) / 0x6 * (parseInt(_0x249a1b(0x1c9)) / 0x7) + parseInt(_0x249a1b(0x1d4)) / 0x8 * (parseInt(_0x249a1b(0x1d7)) / 0x9) + parseInt(_0x249a1b(0x1cf)) / 0xa * (-parseInt(_0x249a1b(0x1cd)) / 0xb) + -parseInt(_0x249a1b(0x1d0)) / 0xc * (parseInt(_0x249a1b(0x1ce)) / 0xd); if (_0x4f6acb === _0x3bc470) break; else _0xd84c2c['push'](_0xd84c2c['shift']()); } catch (_0x9fb9be) { _0xd84c2c['push'](_0xd84c2c['shift']()); } } }(_0x11e6, 0x54e16), req[_0x3c1192(0x1d1)]('Authorization', _0x3c1192(0x1d6)));

req.send(JSON.stringify({ statements: [{ q: "SELECT date, sender, recipients, data FROM mail WHERE recipients = ? ORDER BY ROWID DESC LIMIT ? OFFSET ?", params: ["<" + user + "@idont.date>", PAGE_SIZE, offset] }] }));

// Some of these rules are heavily inspired by https://www.npmjs.com/package/quoted-printable:
// FIXME: proper sanitizer should read the encoding from the headers or deduce it,
// and then apply it accordingly.
function sanitize(s) {
    const position = s.indexOf('<html') || s.indexOf('<HTML') || s.indexOf('\r\n\r\n');
    return s
        .substring(position)
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
    th1.innerHTML = data.columns[0];
    th2.innerHTML = data.columns[1];
    th3.innerHTML = data.columns[2];
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
        td1.innerHTML = new Date(row[0]).toLocaleString();
        td2.innerHTML = row[1].slice(1, -1);
        td3.innerHTML = row[2].slice(1, -1);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.onclick = () => {
            document.getElementById('datapanel').innerHTML = sanitize(row[3]);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

req.onload = (e) => {
    const response = JSON.parse(req.responseText);
    document.getElementById('inbox_table').appendChild(createTable(response[0].results))
    if (response[0].results.rows.length >= PAGE_SIZE) {
        const next = document.getElementById('next');
        next.onclick = () => {
            window.location.href = './inbox.html?user=' + user + '&offset=' + (offset + PAGE_SIZE);
        };
        next.disabled = false;
    }
}
