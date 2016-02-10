Feature: Help

  Scenario: Display docks help information
    When I run `docks help`
    Then the output should contain:
    """
    Usage: docks <action> [options...]
    """
    And the output should contain:
    """
    Actions:
    """
    And the output should contain:
    """
    help      - Outputs this list of actions that can be taken via the CLI.
    """
    And the exit status should be 0
