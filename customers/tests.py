from customers.models import Customer, CustomerStatus


def test_create_customer(db):
    customer = Customer.objects.create(name="Cliente Teste")

    assert customer.name == "Cliente Teste"
    assert customer.status == CustomerStatus.ACTIVE
