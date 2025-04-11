# Note

An internal link. Filters note suggestions based either on their type or on custom dataview queries.

## Parameters

| Parameter       | Value Type                     | Description                                            |
| --------------- | ------------------------------ | ------------------------------------------------------ |
| `...positional` | [STRING](../language#string)   | Allowed note types                                     |
| `dv`            | [STRING](../language#string)   | Custom dataview query                                  |
| `relation`      | [BOOLEAN](../language#boolean) | Whether this field is a relation                       |
| `subtypes`      | [BOOLEAN](../language#boolean) | Whether to allow subtypes of the specified note type(s)|

## Examples

```otl
type A {
    fields {
        parent: Note["A"]
        deps: List[Note["A", "B", "C"]]
    }
}
```

## Picker

@TODO
