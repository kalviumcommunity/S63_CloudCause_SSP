import json
import tempfile
import unittest
from pathlib import Path

from src.ingestion.validation import validate_dataset, validate_raw_datasets


class TestDatasetValidation(unittest.TestCase):
    def write_file(self, directory, name, content, encoding="utf-8"):
        path = Path(directory) / name
        path.write_text(content, encoding=encoding)
        return path

    def test_valid_csv_is_accepted_and_kept_independent(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_file(
                directory,
                "billing.csv",
                "timestamp,service,cost\n2026-01-01,api,12.50\n",
            )
            result = validate_dataset(path, "billing")

        self.assertTrue(result.valid)
        self.assertEqual(list(result.data.columns), ["timestamp", "service", "cost"])
        self.assertEqual(result.errors, [])

    def test_valid_json_is_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_file(
                directory,
                "deployments.json",
                json.dumps([{"service": "api", "version": "1.2.0", "timestamp": "2026-01-01"}]),
            )
            result = validate_dataset(path, "deployments")

        self.assertTrue(result.valid)

    def test_reports_missing_file_and_unsupported_format(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = validate_dataset(Path(directory) / "missing.csv", "billing")
            unsupported_path = self.write_file(directory, "billing.txt", "data")
            unsupported = validate_dataset(unsupported_path, "billing")

        self.assertFalse(missing.valid)
        self.assertIn("not available", missing.errors[0])
        self.assertIn("Unsupported format", unsupported.errors[0])

    def test_reports_schema_types_empty_and_malformed_records(self):
        with tempfile.TemporaryDirectory() as directory:
            bad_schema = self.write_file(directory, "bad.csv", "timestamp,service\n2026-01-01,api\n")
            wrong_type = self.write_file(
                directory,
                "types.csv",
                "timestamp,service,cost\nnot-a-date,api,not-a-number\n",
            )
            malformed = self.write_file(
                directory,
                "malformed.csv",
                "timestamp,service,cost\n2026-01-01,api,12,unexpected-field\n",
            )
            empty = self.write_file(directory, "empty.csv", "timestamp,service,cost\n")

            schema_result = validate_dataset(bad_schema, "billing")
            type_result = validate_dataset(wrong_type, "billing")
            malformed_result = validate_dataset(malformed, "billing")
            empty_result = validate_dataset(empty, "billing")

        self.assertFalse(schema_result.valid)
        self.assertTrue(any("Missing required columns" in error for error in schema_result.errors))
        self.assertTrue(any("invalid datetime" in error for error in type_result.errors))
        self.assertTrue(any("numeric" in error for error in type_result.errors))
        self.assertFalse(malformed_result.valid)
        self.assertFalse(empty_result.valid)

    def test_reports_invalid_encoding(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "billing.csv"
            path.write_bytes(b"timestamp,service,cost\n\xff")
            result = validate_dataset(path, "billing")

        self.assertFalse(result.valid)
        self.assertIn("UTF-8", result.errors[0])

    def test_validates_all_sources_without_combining_them(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            (raw / "billing_data.csv").write_text(
                "timestamp,service,cost\n2026-01-01,api,1\n", encoding="utf-8"
            )
            (raw / "deployment_events.json").write_text(
                '[{"service":"api","version":"1","timestamp":"2026-01-01"}]',
                encoding="utf-8",
            )
            (raw / "usage_metrics.csv").write_text(
                "timestamp,service,cpu_utilization,requests_per_second\n2026-01-01,api,20,4\n",
                encoding="utf-8",
            )
            results = validate_raw_datasets(raw)

        self.assertEqual(set(results), {"billing", "deployments", "usage"})
        self.assertTrue(all(result.valid for result in results.values()))
        self.assertEqual(len(results["billing"].data.columns), 3)
        self.assertEqual(len(results["usage"].data.columns), 4)


if __name__ == "__main__":
    unittest.main()