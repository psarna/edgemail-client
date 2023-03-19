use libsql_client::{params, QueryResult, Statement, Value};
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
    if let Value::Text(t) = v {
        t.replace(['<', '>'], "")
    } else {
        v.to_string()
    }
}

fn inbox_to_html(result: QueryResult) -> String {
    let mut html = "<table style=\"border: 1px solid\">".to_string();
    match result {
        QueryResult::Error((msg, _)) => return format!("Error: {msg}"),
        QueryResult::Success((result, _)) => {
            for column in &result.columns {
                if column != "id" {
                    html += &format!("<th style=\"border: 1px solid\">{column}</th>");
                }
            }
            for row in result.rows {
                let id = &row.cells["id"];
                html += &format!(
                    "<tr style=\"border: 1px solid\" onclick=\"window.location='./inbox/{id}'\">"
                );
                for column in &result.columns {
                    if column != "id" {
                        html += &format!("<td>{}</td>", prepare(&row.cells[column]));
                    }
                }
                html += "</tr>";
            }
        }
    };
    html += "</table>";
    html
}

fn msg_to_html(result: QueryResult) -> String {
    let msg_body = match result {
        QueryResult::Error((msg, _)) => return format!("Error: {msg}"),
        QueryResult::Success((result, _)) => {
            result.rows.first().map(|row| row.cells["data"].to_string())
        }
    };
    msg_body.unwrap_or_else(|| "Error: no rows found".to_string())
}

async fn serve_inbox(db: &impl libsql_client::Connection) -> anyhow::Result<String> {
    let response = db
        .execute("SELECT rowid as id, date, sender, recipients FROM mail ORDER BY rowid DESC")
        .await?;
    let table = inbox_to_html(response);
    let style =
        "<link rel=\"stylesheet\" href=\"https://unpkg.com/papercss@1.9.1/dist/paper.min.css\"/>";
    let intro = "<h3>sorry@idont.date</h3><p>Subscribe to any e-mail in the domain @idont.date and receive it here!</p><br>";
    let footer = "<footer>Made by <a href=\"https://bio.sarna.dev\">sarna</a>, powered by <a href=\"https://chiselstrike.com\">Turso</a></footer>";
    let html = format!("{style}{intro}{table}<br>{footer}");
    Ok(html)
}

async fn serve_msg(db: &impl libsql_client::Connection, id: i64) -> anyhow::Result<String> {
    let response = db
        .execute(Statement::with_params(
            "SELECT date, sender, recipients, data FROM mail WHERE rowid = ?",
            params!(id),
        ))
        .await?;
    Ok(msg_to_html(response))
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    log_request(&req);

    utils::set_panic_hook();
    let router = Router::new();

    router
        .get_async("/", |_req, ctx| async move {
            let db = match libsql_client::workers::Connection::connect_from_ctx(&ctx) {
                Ok(db) => db,
                Err(e) => {
                    console_log!("Error {e}");
                    return Response::from_html(format!("Error establishing connection: {e}"));
                }
            };
            match serve_inbox(&db).await {
                Ok(html) => Response::from_html(html),
                Err(e) => Err(Error::from(format!("{e}"))),
            }
        })
        .get_async("/inbox/:id", |_req, ctx| async move {
            let db = match libsql_client::workers::Connection::connect_from_ctx(&ctx) {
                Ok(db) => db,
                Err(e) => {
                    console_log!("Error {e}");
                    return Response::from_html(format!("Error establishing connection: {e}"));
                }
            };
            let id: i64 = match ctx.param("id").and_then(|id| id.parse::<i64>().ok()) {
                Some(id) => id,
                None => return Response::from_html("Missing message id: /inbox/<X>"),
            };
            match serve_msg(&db, id).await {
                Ok(html) => Response::from_html(html),
                Err(e) => Err(Error::from(format!("{e}"))),
            }
        })
        .get("/worker-version", |_, ctx| {
            let version = ctx.var("WORKERS_RS_VERSION")?.to_string();
            Response::ok(version)
        })
        .run(req, env)
        .await
}
