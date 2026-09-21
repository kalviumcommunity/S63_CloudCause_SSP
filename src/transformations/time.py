"""Timezone-safe transformations for processed analytical datasets."""

from __future__ import annotations

from collections.abc import Mapping

import pandas as pd


class TimestampTransformationError(ValueError):
    """Raised when a dataset cannot be placed on the common analytical timeline."""


def transform_time_fields(
    dataframe: pd.DataFrame,
    timestamp_column: str = "timestamp",
    timezone: str = "UTC",
) -> pd.DataFrame:
    """Return a copy with normalized timestamps and reusable calendar fields.

    Naive timestamps are interpreted in ``timezone``. Aware timestamps are
    converted to ``timezone``. The raw dataframe is never modified.
    """

    if timestamp_column not in dataframe.columns:
        raise TimestampTransformationError(
            f"Missing required timestamp column '{timestamp_column}'."
        )

    result = dataframe.copy()
    original = result[timestamp_column]
    if original.isna().any():
        raise TimestampTransformationError(
            f"Column '{timestamp_column}' contains missing timestamps."
        )

    try:
        timestamps = [pd.to_datetime(value, errors="coerce") for value in original]
        if any(pd.isna(value) for value in timestamps):
            raise TimestampTransformationError(
                f"Column '{timestamp_column}' contains invalid timestamps."
            )
        timestamps = pd.Series(
            [
                value.tz_localize(timezone)
                if value.tzinfo is None
                else value.tz_convert(timezone)
                for value in timestamps
            ],
            index=result.index,
        )
    except TimestampTransformationError:
        raise
    except (TypeError, ValueError) as error:
        raise TimestampTransformationError(
            f"Column '{timestamp_column}' could not be normalized to {timezone}: {error}"
        ) from error

    result[timestamp_column] = timestamps
    result["date"] = timestamps.dt.date
    result["hour"] = timestamps.dt.hour
    result["day"] = timestamps.dt.day
    result["day_of_week"] = timestamps.dt.dayofweek
    result["week"] = timestamps.dt.isocalendar().week.astype("int64")
    result["month"] = timestamps.dt.month
    result["time_period"] = timestamps.dt.strftime("%Y-%m")
    result["week_period"] = timestamps.dt.strftime("%G-W%V")
    return result


def add_time_since_event(
    dataframe: pd.DataFrame,
    events: pd.DataFrame,
    timestamp_column: str = "timestamp",
    event_timestamp_column: str = "timestamp",
    group_column: str = "service",
    output_column: str = "hours_since_event",
    timezone: str = "UTC",
) -> pd.DataFrame:
    """Add elapsed hours since the latest preceding event for each group.

    Rows without a preceding event retain ``NaN``. Both inputs are copied and
    normalized, so this function does not mutate raw or processed inputs.
    """

    if group_column not in dataframe.columns or group_column not in events.columns:
        raise TimestampTransformationError(
            f"Both datasets must contain grouping column '{group_column}'."
        )

    observations = transform_time_fields(dataframe, timestamp_column, timezone)
    event_rows = transform_time_fields(events, event_timestamp_column, timezone)
    event_rows = event_rows[[group_column, event_timestamp_column]].rename(
        columns={event_timestamp_column: "_event_timestamp"}
    )
    observations["_original_order"] = range(len(observations))
    observations = observations.sort_values(timestamp_column).reset_index(drop=True)
    event_rows = event_rows.sort_values("_event_timestamp").reset_index(drop=True)

    merged = pd.merge_asof(
        observations,
        event_rows,
        left_on=timestamp_column,
        right_on="_event_timestamp",
        by=group_column,
        direction="backward",
    )
    merged[output_column] = (
        merged[timestamp_column] - merged["_event_timestamp"]
    ).dt.total_seconds() / 3600
    return merged.sort_values("_original_order").drop(
        columns=["_event_timestamp", "_original_order"]
    ).reset_index(drop=True)


def transform_datasets(
    datasets: Mapping[str, pd.DataFrame],
    timezone: str = "UTC",
    deployment_key: str = "deployments",
) -> dict[str, pd.DataFrame]:
    """Transform independent billing, deployment, and usage dataframes.

    Every dataset receives the same time fields. Billing and usage also receive
    ``hours_since_deployment`` when deployment data is available.
    """

    transformed = {
        name: transform_time_fields(dataframe, timezone=timezone)
        for name, dataframe in datasets.items()
    }
    deployments = transformed.get(deployment_key)
    if deployments is not None:
        for name in ("billing", "usage"):
            if name in transformed:
                transformed[name] = add_time_since_event(
                    transformed[name],
                    deployments,
                    timezone=timezone,
                    output_column="hours_since_deployment",
                )
    return transformed