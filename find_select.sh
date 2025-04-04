#!/bin/bash
filename=client/src/pages/azure-storage-browser.tsx

# Extract just the Select tag lines
grep -n "<Select" "$filename" | sort -n > select_open.txt
grep -n "</Select" "$filename" | sort -n > select_close.txt

# Display them side by side
echo "SELECT OPENING TAGS              SELECT CLOSING TAGS"
echo "---------------------------------------------------"
paste select_open.txt select_close.txt

# Count them
open_count=$(wc -l < select_open.txt)
close_count=$(wc -l < select_close.txt)
echo -e "\nOpening tags: $open_count, Closing tags: $close_count, Difference: $((open_count - close_count))"

