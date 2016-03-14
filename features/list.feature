Feature: List Docks

  Scenario: Getting help
    When I run `docks list -h`
    Then the output should contain:
    """
    Usage: docks-list
    """
    And the exit status should be 0

  Scenario: Listing docks
    Given the following docks:
      | organization | ipAddress |
      | 8452555      | 10.0.0.10 |
      | 17010701     | 10.0.0.20 |
    When I run `docks list -e test`
    Then the output should contain:
    """
    ┌────────────┬────────────────┬────────────┐
    │ Org        │ IP             │ Containers │
    ├────────────┼────────────────┼────────────┤
    │ 8452555    │ 10.0.0.10      │ 0          │
    ├────────────┼────────────────┼────────────┤
    │ 17010701   │ 10.0.0.20      │ 0          │
    └────────────┴────────────────┴────────────┘
    """
    And the exit status should be 0

  Scenario: Listing docks w/ Github names
    Given the following docks:
      | organization | ipAddress |
      | 8452555      | 10.0.0.10 |
      | 17010701     | 10.0.0.20 |
    When I run `docks list -g -e test`
    Then the output should match:
    """
    8452555.+bryan-test
    """
    Then the output should match:
    """
    17010701.+runnabear
    """
    And the exit status should be 0

  Scenario: Listing docks for specific organization
    Given the following docks:
      | organization | ipAddress |
      | 8452555      | 10.0.0.10 |
      | 17010701     | 10.0.0.20 |
    When I run `docks list -o 8452555 -e test`
    Then the output should not contain:
    """
    17010701
    """
    Then the output should contain:
    """
    8452555
    """
