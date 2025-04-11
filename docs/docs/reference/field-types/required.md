# Required

A generic type: Require the underlying field to be present.

- Requires that the field is present, i.e. declared explicitly in the note.
- If the underlying field type is a scalar (i.e. anything except [List](./list)):
  Requires that the field value is not an empty string.
- If the underlying field type is a [List](./list):
  Requires that the list contains at least one item.

## Parameters

| Parameter    | Value Type                           | Description      |
| ------------ | ------------------------------------ | ---------------- |
| `positional` | [FIELD_TYPE](../language#field-type) | Value field type |

## Examples

```otl
type A {
    fields {
        list_str: Required[String]
        list_num: Required[List[string]]
    }
}
```

## Picker

@TODO
