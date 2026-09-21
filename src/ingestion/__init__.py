from .validation import ValidationResult, validate_dataset, validate_raw_datasets

__all__ = [
	"ValidationResult",
	"validate_dataset",
	"validate_raw_datasets",
	"ingest_data",
	"load_csv_data",
	"load_json_data",
]


def __getattr__(name):
	if name in {"ingest_data", "load_csv_data", "load_json_data"}:
		from .ingest import ingest_data, load_csv_data, load_json_data

		return {
			"ingest_data": ingest_data,
			"load_csv_data": load_csv_data,
			"load_json_data": load_json_data,
		}[name]
	raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
