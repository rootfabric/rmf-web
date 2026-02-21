from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Query

from api_server import ros_time

from .models import Pagination


def pagination_query(
    limit: int | None = Query(None, gt=0, le=1000, description="defaults to 100"),
    offset: int | None = Query(None, ge=0, description="defaults to 0"),
    order_by: str | None = Query(
        None,
        description="common separated list of fields to order by, prefix with '-' to sort descendingly.",
    ),
) -> Pagination:
    limit = limit or 100
    offset = offset or 0
    return Pagination(
        limit=limit,
        offset=offset,
        order_by=order_by.split(",") if order_by else [],
    )


def time_between_query(alias: str, *, default: str | None = None):
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    min_unix_millis = int(
        (datetime.min.replace(tzinfo=timezone.utc) - epoch).total_seconds() * 1000
    )
    max_unix_millis = int(
        (datetime.max.replace(tzinfo=timezone.utc) - epoch).total_seconds() * 1000
    )

    def _invalid(detail: str) -> HTTPException:
        return HTTPException(
            status_code=422, detail=f"invalid '{alias}' query: {detail}"
        )

    def _parse_unix_millis(raw: str, *, field: str) -> int:
        try:
            unix_millis = int(raw)
        except ValueError as exc:
            raise _invalid(f"{field} must be an integer unix millis value") from exc
        if unix_millis < min_unix_millis or unix_millis > max_unix_millis:
            raise _invalid(
                f"{field} out of supported range [{min_unix_millis}, {max_unix_millis}]"
            )
        return unix_millis

    def _to_datetime(unix_millis: int) -> datetime:
        try:
            return datetime.fromtimestamp(unix_millis / 1000, timezone.utc)
        except (OverflowError, OSError, ValueError) as exc:
            raise _invalid("value is outside supported datetime range") from exc

    def dep(
        time_between: str | None = Query(
            default,
            alias=alias,
            description="""
            The period of request time to fetch, in unix millis.

            This can be either a comma separated string or a string prefixed with '-' to fetch the last X millis.

            Example:
                "1000,2000" - Fetch resources between unix millis 1000 and 2000.
                "-60000" - Fetch resources in the last minute.
            """,
        ),
        now: int = Depends(ros_time.now),
    ) -> tuple[datetime, datetime] | None:
        if time_between is None:
            return None
        if time_between.startswith("-"):
            period_millis = _parse_unix_millis(time_between[1:], field="duration")
            if period_millis < 0:
                raise _invalid("duration must be non-negative")
            period = (
                _to_datetime(now - period_millis),
                _to_datetime(now),
            )
        else:
            parts = time_between.split(",")
            if len(parts) != 2:
                raise _invalid("expected either '-<millis>' or '<start>,<end>'")
            start_unix_millis = _parse_unix_millis(parts[0], field="start")
            end_unix_millis = _parse_unix_millis(parts[1], field="end")
            if start_unix_millis > end_unix_millis:
                raise _invalid("start must be less than or equal to end")
            period = (
                _to_datetime(start_unix_millis),
                _to_datetime(end_unix_millis),
            )
        return period

    return dep
