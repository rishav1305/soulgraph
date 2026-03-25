"""Tests for the CLI entrypoint.

Covers argument parsing, configuration validation, and error exit paths.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


class TestCLIConfigValidation:
    def test_missing_api_key_exits_with_code_1(self, capsys: pytest.CaptureFixture[str]) -> None:
        """If settings.validate() raises ValueError, the CLI must exit(1)."""
        with patch("sys.argv", ["soulgraph", "what is the capital of France?"]):
            with patch("soulgraph.cli.get_settings") as mock_get_settings:
                s = MagicMock()
                s.validate.side_effect = ValueError("ANTHROPIC_API_KEY is required")
                s.log_level = "INFO"
                mock_get_settings.return_value = s
                with pytest.raises(SystemExit) as exc_info:
                    from soulgraph.cli import main

                    main()
                assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "Configuration error" in captured.err

    def test_config_error_message_contains_exception_text(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """The error message written to stderr must include the exception description."""
        with patch("sys.argv", ["soulgraph", "any question"]):
            with patch("soulgraph.cli.get_settings") as mock_get_settings:
                s = MagicMock()
                s.validate.side_effect = ValueError("missing-key-detail")
                s.log_level = "WARNING"
                mock_get_settings.return_value = s
                with pytest.raises(SystemExit):
                    from soulgraph.cli import main

                    main()
        captured = capsys.readouterr()
        assert "missing-key-detail" in captured.err


class TestCLIHelp:
    def test_help_flag_exits_with_zero(self) -> None:
        """Passing --help must exit with code 0 (standard argparse behaviour)."""
        with patch("sys.argv", ["soulgraph", "--help"]):
            with pytest.raises(SystemExit) as exc_info:
                from soulgraph.cli import main

                main()
            assert exc_info.value.code == 0

    def test_help_output_mentions_soulgraph(self, capsys: pytest.CaptureFixture[str]) -> None:
        """--help output must reference the soulgraph program name."""
        with patch("sys.argv", ["soulgraph", "--help"]):
            with pytest.raises(SystemExit):
                from soulgraph.cli import main

                main()
        captured = capsys.readouterr()
        assert "soulgraph" in captured.out.lower()


class TestCLILogLevel:
    def test_custom_log_level_accepted(self) -> None:
        """--log-level DEBUG should be accepted by the parser without error."""
        with patch("sys.argv", ["soulgraph", "--log-level", "DEBUG", "test question"]):
            with patch("soulgraph.cli.get_settings") as mock_get_settings:
                s = MagicMock()
                s.validate.side_effect = ValueError("stop early — avoid graph invocation")
                s.log_level = "INFO"
                mock_get_settings.return_value = s
                with pytest.raises(SystemExit) as exc_info:
                    from soulgraph.cli import main

                    main()
                # exits with 1 due to config error, not arg parse error
                assert exc_info.value.code == 1
