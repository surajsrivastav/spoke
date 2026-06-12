---
name: writing-user-story-gherkin
description: Write user stories with Gherkin acceptance criteria for Spoke features. Use when defining a new feature, breaking down work, or clarifying requirements with testable conditions.
---

# Writing User Stories with Gherkin

## Overview

User stories describe features from the user's perspective. Gherkin acceptance criteria make them testable with Given/When/Then scenarios.

## When to Use

- Starting a new feature
- Writing PRD for Phase 0 tasks
- Defining "done" for a piece of work
- Creating test cases from requirements

## Story Format

```
As a <persona>
I want <action>
So that <outcome>
```

## Gherkin Template

```gherkin
Feature: <feature name>

  Scenario: <scenario name>
    Given <precondition>
    When <action>
    Then <expected result>
```

### Example

```gherkin
Feature: Slack message creates task

  Scenario: Valid mention creates task
    Given a Slack message contains "@spoke deploy staging"
    When the slack-edge app receives the message
    Then a task is created with action "deploy staging"
    And a confirmation reply is sent to the channel

  Scenario: Message without mention is ignored
    Given a Slack message does not contain "@spoke"
    When the slack-edge app receives the message
    Then no task is created
```

## Formatting Rules

- **Feature**: lowercase, hyphen-separated
- **Scenario**: descriptive sentence
- **Given**: initial context (nouns, state)
- **When**: action or trigger (verbs)
- **Then**: expected outcome (observable result)
- **And/But**: extend any step

Use `Scenario Outline` with `Examples` for data-driven tests:

```gherkin
Scenario Outline: Task creation from channel
  Given a message "<text>" in channel <channel>
  When slack-edge processes the message
  Then a task is created with action "<action>"

  Examples:
    | text | channel | action |
    | "@spoke deploy" | C123 | deploy |
    | "@spoke test" | C456 | test |
```

## Anti-patterns

- ❌ Don't write scenarios without testable outcomes
- ❌ Don't include implementation details in scenarios
- ❌ Don't write stories that span multiple deployment units
- ❌ Don't use vague terms ("should work", "handles correctly")

## Related Skills

- `writing-architecture-decision-record` — Design decisions
- `writing-unit-test-typescript` — Implementing tests from Gherkin
