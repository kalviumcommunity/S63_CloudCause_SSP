import unittest

import pandas as pd

from src.transformations.time import (
    TimestampTransformationError,
    add_time_since_event,
    transform_datasets,
    transform_time_fields,
)


class TestTimeTransformations(unittest.TestCase):
    def test_normalizes_naive_and_aware_timestamps_to_utc(self):
        source = pd.DataFrame(
            {"timestamp": ["2026-01-15 10:30:00", "2026-01-15T12:00:00+02:00"]}
        )
        transformed = transform_time_fields(source, timezone="Europe/Berlin")

        self.assertEqual(str(transformed.loc[0, "timestamp"].tz), "Europe/Berlin")
        self.assertEqual(transformed.loc[1, "timestamp"].hour, 11)
        self.assertEqual(source.loc[0, "timestamp"], "2026-01-15 10:30:00")

    def test_adds_calendar_and_period_fields(self):
        transformed = transform_time_fields(
            pd.DataFrame({"timestamp": ["2026-01-15 10:30:00"]})
        )

        self.assertEqual(transformed.loc[0, "date"], pd.Timestamp("2026-01-15").date())
        self.assertEqual(transformed.loc[0, "hour"], 10)
        self.assertEqual(transformed.loc[0, "day"], 15)
        self.assertEqual(transformed.loc[0, "week"], 3)
        self.assertEqual(transformed.loc[0, "month"], 1)
        self.assertEqual(transformed.loc[0, "time_period"], "2026-01")
        self.assertEqual(transformed.loc[0, "week_period"], "2026-W03")

    def test_rejects_missing_invalid_and_absent_timestamps(self):
        with self.assertRaises(TimestampTransformationError):
            transform_time_fields(pd.DataFrame({"timestamp": [None]}))
        with self.assertRaises(TimestampTransformationError):
            transform_time_fields(pd.DataFrame({"timestamp": ["not-a-date"]}))
        with self.assertRaises(TimestampTransformationError):
            transform_time_fields(pd.DataFrame({"service": ["api"]}))

    def test_calculates_time_since_latest_same_service_event(self):
        observations = pd.DataFrame(
            {
                "timestamp": ["2026-01-01 02:00:00", "2026-01-01 00:30:00"],
                "service": ["api", "worker"],
            }
        )
        deployments = pd.DataFrame(
            {
                "timestamp": ["2026-01-01 01:00:00"],
                "service": ["api"],
            }
        )
        transformed = add_time_since_event(observations, deployments)

        self.assertEqual(transformed.loc[0, "hours_since_event"], 1.0)
        self.assertTrue(pd.isna(transformed.loc[1, "hours_since_event"]))

    def test_transforms_sources_independently_and_adds_deployment_age(self):
        datasets = {
            "billing": pd.DataFrame({"timestamp": ["2026-01-01 02:00"], "service": ["api"]}),
            "deployments": pd.DataFrame({"timestamp": ["2026-01-01 01:00"], "service": ["api"]}),
            "usage": pd.DataFrame({"timestamp": ["2026-01-01 03:00"], "service": ["api"]}),
        }
        transformed = transform_datasets(datasets)

        self.assertEqual(transformed["billing"].loc[0, "hours_since_deployment"], 1.0)
        self.assertEqual(transformed["usage"].loc[0, "hours_since_deployment"], 2.0)
        self.assertNotIn("hours_since_deployment", transformed["deployments"])
        self.assertEqual(list(datasets["billing"].columns), ["timestamp", "service"])


if __name__ == "__main__":
    unittest.main()