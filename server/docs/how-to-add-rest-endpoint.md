# How To Add A REST Endpoint

REST endpoints live in `src/presentation/controllers/rest/`. Keep controllers thin: validate input, call application code, return a response.

## Flow

```text
REST controller -> RequestDataValidator/Joi scheme -> application service -> infrastructure repository -> response
```

## Steps

1. Add or extend a controller in `src/presentation/controllers/rest/`.
2. Add a Joi scheme in `src/presentation/schemes/` near related schemes.
3. Add or reuse a DTO from `src/domain/types/dto/` when the payload crosses layers.
4. Add application behavior to a service in `src/application/services/`.
5. Add repository methods in `src/infrastructure/database/repositories/` only when persistence access is needed.
6. Wrap route handlers with `asyncHandler`.
7. Return HTTP statuses from `HttpStatus`.
8. Throw `ClientError` for expected user-facing failures.
9. Update `../openapi/schema.json` for the endpoint, request/response schemas, errors, and side effects such as socket lobby events.

## Controller Pattern

```typescript
router.post(`/`, asyncHandler(this.createThing));

createThing = async (req: Request, res: Response) => {
  const input = new RequestDataValidator<CreateThingDTO>(
    req.body,
    createThingScheme()
  ).validate();

  const result = await this.thingService.create(input);
  return res.status(HttpStatus.OK).send(result);
};
```

## Where Logic Belongs

- Request shape validation belongs in `presentation/schemes/`.
- Auth and permissions belong in middleware or application services, depending on whether they are transport-specific.
- Business validation belongs in `domain/validators/` or `domain/logic/` when it does not need I/O.
- Database reads and writes belong in infrastructure repositories.
- Response shaping should use DTOs or existing mappers instead of leaking infrastructure models.

## Checklist

- The controller does not access Redis or repositories directly.
- The service does not parse Express request bodies.
- The repository does not throw translated user-facing errors unless the existing repository already owns that behavior.
- Input DTOs and response DTOs are typed.
- Errors use `ClientError` or `ServerError` consistently.
- Relevant tests cover validation and service behavior when the endpoint changes behavior.
- `../openapi/schema.json` matches the implemented validation rules and response body.
