use libsql_client::{params, Col, Statement, StmtResult, Value};
use worker::*;

mod utils;

// Log each request to dev console
fn log_request(req: &Request) {
    console_log!(
        "{} - [{}], located at: {:?}, within: {}",
        Date::now().to_string(),
        req.path(),
        req.cf().coordinates().unwrap_or_default(),
        req.cf().region().unwrap_or_else(|| "unknown region".into())
    );
}

fn prepare(v: &Value) -> String {
    if let Value::Text { value: t } = v {
        t.replace(['<', '>'], "")
    } else {
        v.to_string()
    }
}

fn inbox_to_html(result: StmtResult) -> String {
    let mut html = "<table class=\"table-hover\" style=\"border: 1px solid\">".to_string();

    for Col { name: column } in &result.cols {
        let column = column.as_deref().unwrap();
        if column != "id" && column != "data" {
            html += &format!("<th style=\"border: 1px solid\">{column}</th>");
        }
    }
    let id_idx = result
        .cols
        .iter()
        .position(|c| c.name.as_deref() == Some("id"))
        .unwrap();
    let data_idx = result
        .cols
        .iter()
        .position(|c| c.name.as_deref() == Some("data"))
        .unwrap();
    for row in result.rows {
        let id = &row[id_idx];
        html += &format!(
            "<tr style=\"border: 1px solid\" onclick=\"document.getElementById('datapanel').innerHTML = document.getElementById('data{id}').value\">"
        );
        for (cell_idx, cell) in row.iter().enumerate() {
            if cell_idx != id_idx && cell_idx != data_idx {
                html += &format!("<td>{}</td>", prepare(cell));
            } else if cell_idx == data_idx {
                let contents = if let Value::Text { value: t } = &cell {
                    let start = t.find("<html").unwrap_or_else(|| {
                        t.find("<HTML")
                            .unwrap_or_else(|| t.find("\r\n\r\n").unwrap_or(0))
                    });
                    &t[start..]
                } else {
                    ""
                };
                html += &format!(
                    "<textarea id=\"data{id}\" style=\"display:none\">{contents}</textarea>",
                );
            }
        }
        html += "</tr>";
    }

    html += "</table><div id=\"datapanel\" style=\"height: 50%; width: 80%; margin: auto\"></div>";
    html
}

async fn serve_inbox(db: &impl libsql_client::DatabaseClient, id: &str) -> anyhow::Result<String> {
    let canonical_id = format!("<{id}@idont.date>");
    let response = db
        .execute(Statement::with_params("SELECT rowid as id, date, sender, recipients, data FROM mail WHERE recipients = ? ORDER BY rowid DESC", params!(canonical_id)))
        .await?;
    let table = inbox_to_html(response);
    Ok(format!(
        r#"
    <link rel="stylesheet" href="https://unpkg.com/papercss@1.9.1/dist/paper.min.css"/>
    <div style="margin:auto; width:50%">
    <h3>sorry@idont.date</h3><h4>{id}@idont.date's inbox:</h4><h5>Made by <a href="https://bio.sarna.dev">sarna</a>, powered by <a href="https://chiselstrike.com">Turso</a></h5><br>
    </div>
    {table}
    <br>
    <div style="margin:auto; width:50%">
    "#
    ))
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    log_request(&req);

    utils::set_panic_hook();
    let router = Router::new();

    router
        .get_async("/inbox/:id", |_req, ctx| async move {
            let db = match libsql_client::workers::Client::from_ctx(&ctx) {
                Ok(db) => db,
                Err(e) => {
                    console_log!("Error {e}");
                    return Response::from_html(format!("Error establishing connection: {e}"));
                }
            };
            let id: String = match ctx.param("id").and_then(|id| id.parse::<String>().ok()) {
                Some(id) => id,
                None => return Response::from_html("Missing inbox id: /inbox/<X>"),
            };
            match serve_inbox(&db, &id).await {
                Ok(html) => Response::from_html(html),
                Err(e) => Err(Error::from(format!("{e}"))),
            }
        })
        .get("/", |_req, _ctx| {
            Response::from_html(r#"
            <link rel="stylesheet" href="https://unpkg.com/papercss@1.9.1/dist/paper.min.css"/>
            <div style="margin:auto; width:50%">
            <h3>sorry@idont.date</h3>
            <p>Temporary e-mail service.<br>Pick a username of your choice and go to your temporary inbox.<br>All inboxes are public.<br>Old e-mails get automatically deleted.</p>
            <p>Choose your username:</p>
            <form action="javascript:window.location.href= './inbox/' + (document.getElementById('inbox').value || 'test1')">
              <input type="text" id="inbox" name="inbox" placeholder="test1">
              <button type="button" onclick="window.location.href= './inbox/' + (document.getElementById('inbox').value || 'test1')">Go to Inbox</button>
            </form>
            <h5>Made by <a href="https://bio.sarna.dev">sarna</a>, powered by <a href="https://chiselstrike.com">Turso</a></h5>
            </div>
            "#)
        })
        .get("/worker-version", |_, ctx| {
            let version = ctx.var("WORKERS_RS_VERSION")?.to_string();
            Response::ok(version)
        })
        .run(req, env)
        .await
}
