from app.schemas.pagination import PaginatedResponse, PaginationParams


def test_pagination_params_offset():
    p1 = PaginationParams(page=1, page_size=20)
    assert p1.offset == 0

    p2 = PaginationParams(page=3, page_size=15)
    assert p2.offset == 30


def test_paginated_response_creation():
    items = ["item1", "item2", "item3"]
    params = PaginationParams(page=1, page_size=10)
    response = PaginatedResponse.create(items=items, total=25, params=params)

    assert response.items == items
    assert response.total == 25
    assert response.page == 1
    assert response.page_size == 10
    assert response.total_pages == 3
