"""
Basic data validation tests for the CostTrace pipeline.

Run:
    python -m pytest tests/ -v
    python tests/test_data_validation.py
"""

import os
import sys
import unittest
import pandas as pd
import pandera as pa

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from src.ingestion.ingest import ingest_data
from src.cleaning.clean import clean_all_data
from src.feature_engineering.features import feature_engineer_data
from src.analysis.correlate import analyze_cost_spikes

RAW_DATA_DIR = os.path.join(project_root, "data", "raw")
MISSING_VALUE_THRESHOLD = 0.10


class TestDataIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw_data = ingest_data(RAW_DATA_DIR)

    def test_ingestion_returns_three_datasets(self):
        self.assertEqual(set(self.raw_data.keys()), {"billing", "deployments", "usage"})

    def test_billing_schema_columns(self):
        expected = {"timestamp", "service", "cost"}
        self.assertTrue(expected.issubset(set(self.raw_data["billing"].columns)))

    def test_deployment_schema_columns(self):
        expected = {"service", "version", "timestamp"}
        self.assertTrue(expected.issubset(set(self.raw_data["deployments"].columns)))

    def test_usage_schema_columns(self):
        expected = {"timestamp", "service", "cpu_utilization", "requests_per_second"}
        self.assertTrue(expected.issubset(set(self.raw_data["usage"].columns)))

    def test_no_empty_datasets(self):
        for name, df in self.raw_data.items():
            self.assertGreater(len(df), 0, f"Raw dataset '{name}' is empty")


class TestDataCleaning(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw_data = ingest_data(RAW_DATA_DIR)
        cls.cleaned = clean_all_data(raw_data)

    def test_service_names_are_lowercase(self):
        for name in ["billing", "deployments", "usage"]:
            df = self.cleaned[name]
            self.assertTrue(
                df["service"].str.islower().all(),
                f"Service names in '{name}' are not all lowercase",
            )

    def test_no_duplicate_rows(self):
        for name, df in self.cleaned.items():
            dup_count = df.duplicated().sum()
            self.assertEqual(dup_count, 0, f"Found {dup_count} duplicates in '{name}'")

    def test_missing_values_within_threshold(self):
        for name, df in self.cleaned.items():
            total = df.size
            missing = int(df.isnull().sum().sum())
            ratio = missing / total if total > 0 else 0
            self.assertLessEqual(
                ratio,
                MISSING_VALUE_THRESHOLD,
                f"'{name}' missing ratio {ratio:.2%} exceeds {MISSING_VALUE_THRESHOLD:.2%}",
            )

    def test_cost_non_negative(self):
        self.assertTrue((self.cleaned["billing"]["cost"] >= 0).all())

    def test_cpu_utilization_in_range(self):
        cpu = self.cleaned["usage"]["cpu_utilization"]
        self.assertTrue((cpu >= 0).all() and (cpu <= 100).all())

    def test_requests_non_negative(self):
        self.assertTrue((self.cleaned["usage"]["requests_per_second"] >= 0).all())


class TestFeatureEngineering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw_data = ingest_data(RAW_DATA_DIR)
        cleaned = clean_all_data(raw_data)
        cls.featured = feature_engineer_data(cleaned)

    def test_rolling_avg_present(self):
        df = self.featured["combined_data"]
        self.assertIn("rolling_avg_cost", df.columns)
        self.assertIn("cost_spike", df.columns)

    def test_cost_spike_is_boolean(self):
        df = self.featured["combined_data"]
        self.assertTrue(df["cost_spike"].dtype == bool)

    def test_deployment_columns_exist(self):
        df = self.featured["combined_data"]
        self.assertIn("deployment_version", df.columns)
        self.assertIn("deployment_timestamp", df.columns)


class TestCorrelationAnalysis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw_data = ingest_data(RAW_DATA_DIR)
        cleaned = clean_all_data(raw_data)
        featured = feature_engineer_data(cleaned)
        cls.correlations = analyze_cost_spikes(
            featured["combined_data"], featured["usage"]
        )

    def test_correlation_output_schema(self):
        expected_cols = {
            "spike_time",
            "affected_service",
            "suspected_cause",
            "confidence_score",
        }
        self.assertTrue(expected_cols.issubset(set(self.correlations.columns)))

    def test_confidence_in_01_range(self):
        if len(self.correlations) == 0:
            self.skipTest("No spikes detected - skipping confidence range check")
        scores = self.correlations["confidence_score"]
        self.assertTrue((scores >= 0).all() and (scores <= 1).all())

    def test_causes_are_valid(self):
        valid_causes = {"Deployment", "External Traffic/Usage Increase", "Unknown"}
        if len(self.correlations) == 0:
            self.skipTest("No spikes detected - skipping cause check")
        self.assertTrue(self.correlations["suspected_cause"].isin(valid_causes).all())


class TestPipelineIntegration(unittest.TestCase):
    def test_full_pipeline_runs_without_exception(self):
        try:
            raw = ingest_data(RAW_DATA_DIR)
            cleaned = clean_all_data(raw)
            featured = feature_engineer_data(cleaned)
            correlations = analyze_cost_spikes(
                featured["combined_data"], featured["usage"]
            )
        except Exception as e:
            self.fail(f"Full pipeline raised {type(e).__name__}: {e}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
