## ADDED Requirements

### Requirement: Salvage is the odyssey's currency

The currency list SHALL include Salvage as a fourth named currency, ordered after the existing three
so that the last entry remains the newest act's own currency. Salvage SHALL behave as an ordinary
currency: monotonic accumulation, spendable, floored at zero by the same wallet write path as the
others, and displayed as a header chip under the existing display rule.

No component SHALL name a currency literally. Currency chips are rendered from the currency
configuration list, because the manual click's currency is overridable per act and a component
holding a literal is a defect waiting for the act that changes it.

#### Scenario: Salvage before the odyssey

- **WHEN** the player is in an act that pays no Salvage and holds none
- **THEN** no Salvage chip is displayed, consistent with the existing rule that a currency not yet
  introduced is not shown even at a zero balance

#### Scenario: Crediting and debiting Salvage

- **WHEN** Salvage is credited or debited through the wallet
- **THEN** it behaves exactly as the other currencies do, including being floored at zero on a debit
  larger than the balance, with no currency-specific handling anywhere in the wallet

### Requirement: Adding a currency does not invalidate an existing save

Introducing a new currency SHALL NOT change the save version. A wallet written before the currency
existed omits its key entirely; every balance read MUST treat an absent key as a zero balance rather
than as a broken save.

#### Scenario: An in-flight save predating the new currency

- **WHEN** a save whose wallet has no key for the new currency is loaded
- **THEN** the save is accepted, the new currency reads as zero, and it can be credited and spent
  from that point on
