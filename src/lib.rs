use libsql_client::{QueryResult, Value};
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
        t.replace('<', "").replace('>', "")
    } else {
        v.to_string()
    }
}

// Take a query result and render it into a HTML table
fn result_to_html_table(result: QueryResult) -> String {
    let mut html = "<table style=\"border: 1px solid\">".to_string();
    match result {
        QueryResult::Error((msg, _)) => return format!("Error: {msg}"),
        QueryResult::Success((result, _)) => {
            for column in &result.columns {
                html += &format!("<th style=\"border: 1px solid\">{column}</th>");
            }
            for row in result.rows {
                html += "<tr style=\"border: 1px solid\">";
                for column in &result.columns {
                    if column == "data" {
                        html += &format!(
                            "<td><textarea rows=10 cols=50>{}</textarea></td>",
                            row.cells[column]
                        );
                    } else {
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

async fn serve(db: &impl libsql_client::Connection) -> anyhow::Result<String> {
    let response = db.execute("SELECT * FROM mail ORDER BY rowid DESC").await?;
    let table = result_to_html_table(response);
    let style =
        "<link rel=\"stylesheet\" href=\"https://unpkg.com/papercss@1.9.1/dist/paper.min.css\"/>";
    let intro = "<h3>sorry@idont.date</h3><p>Subscribe to any e-mail in the domain @idont.date and receive it here!</p><br>";
    let footer = "<footer>Made by <a href=\"https://bio.sarna.dev\">sarna</a>, powered by <a href=\"https://chiselstrike.com\">Turso</a></footer>";
    let html = format!("{style}{intro}{table}{footer}");
    Ok(html)
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
            match serve(&db).await {
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

#[cfg(test)]
mod tests {
    use libsql_client::{Connection, ResultSet, Value};
    fn test_db() -> libsql_client::local::Connection {
        libsql_client::local::Connection::in_memory().unwrap()
    }

    #[tokio::test]
    async fn test_counter_updated() {
        let db = test_db();

        let payloads = [
            ("waw", "PL", "Warsaw", (52.1672, 20.9679)),
            ("waw", "PL", "Warsaw", (52.1672, 20.9679)),
            ("waw", "PL", "Warsaw", (52.1672, 20.9679)),
            ("hel", "FI", "Helsinki", (60.3183, 24.9497)),
            ("hel", "FI", "Helsinki", (60.3183, 24.9497)),
        ];

        for p in payloads {
            super::serve(p.0, p.1, p.2, p.3, &db).await.unwrap();
        }

        let ResultSet { columns, rows } = db
            .execute("SELECT country, city, value FROM counter")
            .await
            .unwrap()
            .into_result_set()
            .unwrap();

        assert_eq!(columns, vec!["country", "city", "value"]);
        for row in rows {
            let city = match &row.cells["city"] {
                Value::Text(c) => c.as_str(),
                _ => panic!("Invalid entry for a city: {:?}", row),
            };
            match city {
                "Warsaw" => assert_eq!(row.cells["value"], 3.into()),
                "Helsinki" => assert_eq!(row.cells["value"], 2.into()),
                _ => panic!("Unknown city: {:?}", row),
            }
        }
    }
}
