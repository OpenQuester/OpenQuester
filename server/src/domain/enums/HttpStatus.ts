export enum HttpStatus {
  // 2xx: Success
  OK = 200,
  NO_CONTENT = 204,

  // 4xx: Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,

  // 5xx: Server Errors
  SERVICE_UNAVAILABLE = 503,
  INTERNAL = 500
}
