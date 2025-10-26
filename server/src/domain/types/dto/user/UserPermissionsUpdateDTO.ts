/**
 * DTO for updating user permissions
 */
export interface UserPermissionsUpdateDTO {
  /**
   * Array of permission names to assign to the user
   * This will replace all existing permissions with the new set
   */
  permissions: string[];
}
