# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Need to do

1. **Location Routes:**

| Method | Routes                               |
| ------ | ------------------------------------ |
| POST   | /locations // add location(admin)    |
| GET    | /locations // list all the locations |
| GET    | /locations/:id //location details    |
| GET    | /locations/nearby //places nearby    |

Params for /nearby:

```bash
?lat=...
&lng=...
&radius=5000 (meters)
```

2. **AI Routes:**

| Method | Routes                                                            |
| ------ | ----------------------------------------------------------------- |
| POST   | /ai/suggest //suggest places based on user's location + interests |
| POST   | //ai/generate-embedding // generate vector for a location         |
| GET    | /ai/recommend-locations // personalized recommended places        |

This project was created using `bun init` in bun v1.2.23. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
