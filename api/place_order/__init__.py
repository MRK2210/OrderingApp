import json, uuid, os
from datetime import datetime
import azure.functions as func
from azure.data.tables import TableServiceClient

TABLE_CONN = os.environ.get("TABLE_CONN")
TABLE_NAME = "orders"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",          # You can scope this to your SWA domain if you prefer
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
}

def main(req: func.HttpRequest) -> func.HttpResponse:
    # --- Handle preflight ---
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=CORS_HEADERS)

    # --- Validate input ---
    try:
        data = req.get_json()
    except Exception as e:
        return func.HttpResponse(f"Invalid JSON: {e}", status_code=400, headers=CORS_HEADERS)

    retailer = (data.get("retailerName") or "").strip()
    items = data.get("items") or []
    if not retailer or not items:
        return func.HttpResponse("Missing retailerName or items", status_code=400, headers=CORS_HEADERS)

    # --- Check env var ---
    if not TABLE_CONN:
        return func.HttpResponse("TABLE_CONN is not set in app settings.", status_code=500, headers=CORS_HEADERS)

    # --- Save to Table Storage ---
    try:
        svc = TableServiceClient.from_connection_string(TABLE_CONN)
        table = svc.create_table_if_not_exists(TABLE_NAME)
        entity = {
            "PartitionKey": retailer,
            "RowKey": str(uuid.uuid4()),
            "PlacedAt": datetime.utcnow().isoformat() + "Z",
            "ItemsJson": json.dumps(items, ensure_ascii=False)
        }
        table.create_entity(entity)
    except Exception as e:
        return func.HttpResponse(f"Storage error: {e}", status_code=500, headers=CORS_HEADERS)

    return func.HttpResponse(
        json.dumps({"message": "Order received"}),
        status_code=200,
        headers={**CORS_HEADERS, "Content-Type": "application/json"}
    )
