from django.db import migrations

CREATE_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION validate_work_order_customer_equipment()
RETURNS trigger AS $$
DECLARE
    equipment_customer uuid;
BEGIN
    SELECT customer_id INTO equipment_customer
    FROM inventory_equipment
    WHERE id = NEW.equipment_id;

    IF equipment_customer IS NULL THEN
        RAISE EXCEPTION 'Equipment % does not exist', NEW.equipment_id;
    END IF;

    IF NEW.customer_id <> equipment_customer THEN
        RAISE EXCEPTION 'WorkOrder customer_id must match equipment customer_id';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

CREATE_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS work_order_customer_equipment_match ON workorders_workorder;
CREATE TRIGGER work_order_customer_equipment_match
BEFORE INSERT OR UPDATE OF customer_id, equipment_id ON workorders_workorder
FOR EACH ROW
EXECUTE FUNCTION validate_work_order_customer_equipment();
"""

DROP_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS work_order_customer_equipment_match ON workorders_workorder;
DROP FUNCTION IF EXISTS validate_work_order_customer_equipment();
"""


def create_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(CREATE_FUNCTION_SQL)
        cursor.execute(CREATE_TRIGGER_SQL)


def drop_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(DROP_TRIGGER_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("workorders", "0002_workorder_work_order_completed_at_only_when_completed_and_more"),
        ("inventory", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(create_trigger, drop_trigger),
    ]
