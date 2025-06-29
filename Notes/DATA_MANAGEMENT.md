# Champion Data & Asset Guide

This document outlines the standard operating procedures for adding and managing Champion data. Adhering to these guidelines is crucial for ensuring the bot's gacha, collection, and future combat systems can function correctly.

## 1. Champion Tiers and Data Storage

Champions are divided into two categories based on their rarity tier:

| Tiers   | Rarity      | Data Source                                       | Description                                                                                             |
| :------ | :---------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **1-4** | Generated   | Common, Uncommon, Rare, Epic                      | These Champions are procedurally generated upon being summoned. Their stats, names, and skills are rolled from predefined lists and stored uniquely for each player in the database. They do not have static `.json` files. |
| **5-7** | Predefined  | Legendary, Mythic, Empyrean                       | These are unique, hand-crafted Champions. Each has a static `.json` file in the `/assets/Champions/` directory that defines their base identity and starting abilities.                                         |

## 2. Asset and Metadata Structure (Tiers 5-7)

All Predefined Champion assets and their metadata **must** be placed within the `/assets/Champions/` directory, organized by their rarity.

```
/assets
└── /Champions
    ├── /Legendary
    │   ├── Seraphina.png
    │   └── Seraphina.json
    ├── /Mythic
    └── /Empyrean
```

-   **Image File:** A `.png` file with the Champion's unique name (e.g., `Seraphina.png`).
-   **Metadata File:** A `.json` file with the exact same name as the image (e.g., `Seraphina.json`).

### 2.1. Metadata File (`.json`) Structure

This file defines the core identity of a Tier 5-7 Champion.

```json
{
  "firstName": "Seraphina",
  "lastName": "Lightwing",
  "title": "The Azure Blade",
  "gender": "F",
  "age": 127,
  "species": "Elf",
  "world": "Aethelgard",
  "class": "Spellblade",
  "element": "Wind",
  "personality": "Calm and Observant",
  "romance": "Lesbian",
  "baseStats": {
    "strength": 3,
    "intelligence": 4,
    "hp": 3,
    "dexterity": 5,
    "mana": 4
  },
  "activeSkills": [
    "Aether Slash",
    "Gale Force"
  ],
  "passiveSkills": [
    "Sword Mastery",
    "Enhanced Reflexes",
    "Mana Font",
    "Poison Resistance"
  ],
  "passiveKnowledge": [
    "Parry",
    "Dodge"
  ]
}
```

#### Field Breakdown:

*   **`firstName` / `lastName`**: The Champion's name. The combination must be unique among Predefined Champions.
*   **`title`**: An epithet for Tier 5-7 Champions.
*   **`gender`**: `M` (Male) or `F` (Female).
*   **`age`**: The Champion's age in years.
*   **`species`**: The race or species of the Champion (e.g., "Human", "Elf", "Dwarf").
*   **`world`**: The origin world or faction of the Champion.
*   **`class`**: The Champion's class, which defines their base stat potential. See `GAME_DATA.md` for a full list.
*   **`element`**: The Champion's elemental affinity. See `GAME_DATA.md`.
*   **`personality`**: Keywords describing the Champion's nature. See `GAME_DATA.md`.
*   **`romance`**: `Straight`, `Gay`, or `Lesbian`.
*   **`baseStats`**: An object defining the starting potential (1-5) for each stat. This determines the XP required to level up a given stat.
*   **`activeSkills`**: An array of names for the Champion's starting active abilities. The number of skills is determined by rarity.
*   **`passiveSkills`**: An array of names for the Champion's starting passive skills. The number of skills is determined by rarity.
*   **`passiveKnowledge`**: An array of inherent combat techniques the Champion knows from the start.

## 3. Rarity-Based Rules

The rarity of a Champion, determined by the folder it resides in, dictates its starting abilities.

| Rarity (Tier) | Active Skills | Passive Skills |
| :------------ | :------------ | :------------- |
| Common (1)    | 1             | 1              |
| Uncommon (2)  | 1             | 1              |
| Rare (3)      | 1             | 1              |
| Epic (4)      | 1             | 2              |
| Legendary (5) | 2             | 4              |
| Mythic (6)    | 3             | 4              |
| Empyrean (7)  | 4             | 4              |

## 4. Uniqueness and Ownership

-   Each Champion, whether Predefined or Generated, is a **unique entity** in the database once summoned by a player.
-   No two players can own the same instance of a Champion at the same time.
-   If a player loses a Champion (e.g., through a future game mechanic), that specific instance is permanently gone. However, another player may summon a *new instance* of that same Predefined Champion (like Seraphina) or a new Generated Champion.