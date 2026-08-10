## Purpose

Defines the game's multiple currencies, how they succeed one another as the player progresses,
and the safety invariants that guarantee a player can always recover from losses.

## ADDED Requirements

### Requirement: Multiple named currencies

The game SHALL track several distinct named currencies rather than a single balance. Each act
has a primary currency, and currencies succeed one another as the player progresses. Every
currency the player has ever held MUST remain readable in game state after it stops being the
primary currency.

#### Scenario: Earning the current act's primary currency

- **WHEN** the player performs an income-generating action in an act
- **THEN** that act's primary currency increases and is displayed to the player

#### Scenario: Currency succession at an act boundary

- **WHEN** the player advances into an act whose primary currency differs from the previous act's
- **THEN** the previous currency is converted at a defined rate, the new currency becomes
  primary, and the retired currency is no longer displayed as a spendable balance

#### Scenario: Only relevant currencies are displayed

- **WHEN** the player is in an act
- **THEN** only currencies relevant to that act are displayed; currencies not yet introduced are
  not shown, including at a zero balance

### Requirement: Currency balances never go negative

No mechanic SHALL reduce any currency below zero. A purchase, wager, penalty, or any other cost
MUST be rejected if the player cannot afford it, rather than producing a negative balance or a
debt.

#### Scenario: Attempting an unaffordable purchase

- **WHEN** the player attempts a purchase costing more than their current balance
- **THEN** the purchase is rejected, the balance is unchanged, and the interface indicates the
  purchase is unaffordable

#### Scenario: A loss larger than the balance

- **WHEN** a mechanic would deduct more of a currency than the player holds
- **THEN** the deduction is bounded so the balance does not fall below zero

### Requirement: Bounded risk on wagering mechanics

Mechanics in which the player can lose currency SHALL bound the amount at stake as a proportion
of the player's current holdings, so the absolute loss shrinks as the player approaches zero. A
player MUST NOT be able to lose their entire balance in a single action.

#### Scenario: Staking at a high balance

- **WHEN** the player wagers with a large balance
- **THEN** the maximum stake is capped at a defined proportion of that balance

#### Scenario: Staking at a low balance

- **WHEN** the player wagers with a balance near zero
- **THEN** the maximum stake scales down proportionally and a total loss still leaves the player
  able to continue earning

### Requirement: A manual income action is always available

A manual, always-available income action SHALL exist in every act and MUST NOT be removed or
disabled by any mechanic. This action is the guarantee that no sequence of losses can leave the
game unrecoverable.

#### Scenario: Recovering from a total loss

- **WHEN** the player has lost as much currency as the game's mechanics permit
- **THEN** the manual income action remains available and the player can recover to a playable
  balance in bounded time

#### Scenario: The manual action persists into later acts

- **WHEN** the player advances beyond the act in which the manual action was introduced
- **THEN** the action remains available, with its value scaled to the current act
