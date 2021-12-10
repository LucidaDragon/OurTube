import sys
authors = []

for line in sys.stdin:
	if not line in authors:
		authors.append(line)

file = open("AUTHORS.md", "w")

file.write("# Authors\n\n#### Ordered by first contribution.\n\n")
for line in authors:
	file.write(f"- {line.strip()}\n")