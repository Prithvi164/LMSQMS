#!/bin/bash

# Fix all tour routes in one go
sed -i 's/app.get(.\/api\/tours\/:id., requireAuth,/app.get(\1, async (req, res) => {\n    if (!req.user) {\n      return res.status(401).json({ message: "Unauthorized" });\n    }/' server/routes.ts
sed -i 's/app.post(.\/api\/tours., requireAuth,/app.post(\1, async (req, res) => {\n    if (!req.user) {\n      return res.status(401).json({ message: "Unauthorized" });\n    }/' server/routes.ts
sed -i 's/app.put(.\/api\/tours\/:id., requireAuth,/app.put(\1, async (req, res) => {\n    if (!req.user) {\n      return res.status(401).json({ message: "Unauthorized" });\n    }/' server/routes.ts
sed -i 's/app.delete(.\/api\/tours\/:id., requireAuth,/app.delete(\1, async (req, res) => {\n    if (!req.user) {\n      return res.status(401).json({ message: "Unauthorized" });\n    }/' server/routes.ts
sed -i 's/app.get(.\/api\/tours\/progress., requireAuth,/app.get(\1, async (req, res) => {\n    if (!req.user) {\n      return res.status(401).json({ message: "Unauthorized" });\n    }/' server/routes.ts
sed -i 's/app.post(.\/api\/tours\/progress., requireAuth,/app.post(\1, async (req, res) => {\n    if (!req.user) {\n      return res.status(401).json({ message: "Unauthorized" });\n    }/' server/routes.ts

echo "All routes fixed"
