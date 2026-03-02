import json
import uuid
import os
from datetime import datetime
import azure.functions as func
from azure.data.tables import TableServiceClient

# App setting to be added in SWA Configuration
TABLE_CONN = os.environ["TABLE_CONN"]  # Storage account connection string
TABLE_NAME = "orders"

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
    except Exception:
        return func.HttpResponse("Invalid JSON", status_code=400)

    retailer = (data.get("retailerName") or "").strip()
    items = data.get("items") or []
    if not retailer or not items:
        return func.HttpResponse("Missing retailerName or items", status_code=400)

    order_id = str(uuid.uuid4())
    placed_at = datetime.utcnow().isoformat() + "Z"

    # Save to Azure Table Storage
    svc = TableServiceClient.from_connection_string(TABLE_CONN)
    table = svc.create_table_if_not_exists(TABLE_NAME)
    table.create_entity({
        "PartitionKey": retailer,
        "RowKey": order_id,
        "PlacedAt": placed_at,
        "ItemsJson": json.dumps(items, ensure_ascii=False)
    })

    return func.HttpResponse(
        json.dumps({"message": "Order received", "orderId": order_id}),
        status_code=200,
        mimetype="application/json"
    )
