#!/bin/bash
filename=client/src/pages/azure-storage-browser.tsx

# Check for unbalanced curly braces
open_braces=$(grep -o "{" "$filename" | wc -l)
close_braces=$(grep -o "}" "$filename" | wc -l)
echo "Opening braces: $open_braces"
echo "Closing braces: $close_braces"
echo "Difference: $((open_braces - close_braces))"

# Check for unbalanced parentheses
open_parens=$(grep -o "(" "$filename" | wc -l)
close_parens=$(grep -o ")" "$filename" | wc -l)
echo "Opening parentheses: $open_parens"
echo "Closing parentheses: $close_parens"
echo "Difference: $((open_parens - close_parens))"

# Check for specific tag balance
for tag in "Dialog" "Card" "Button" "ScrollArea" "div" "Select"
do
  open_tag=$(grep -o "<$tag" "$filename" | wc -l)
  close_tag=$(grep -o "</$tag" "$filename" | wc -l)
  echo "$tag tag - Open: $open_tag, Close: $close_tag, Diff: $((open_tag - close_tag))"
done

