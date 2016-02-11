Feature: Help

  Scenario: Display docks help information
    When I run `docks help`
    Then the output should contain:
    """
    Usage: docks [options] [command]
    """
    And the output should contain:
    """
    Commands:
    """
    And the output should contain:
    """
    help [cmd]  display help for [cmd]
    """
    And the exit status should be 0
