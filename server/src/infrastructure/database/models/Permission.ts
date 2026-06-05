import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Permissions } from "domain/enums/Permissions";
import { User } from "infrastructure/database/models/User";

export interface PermissionModel {
  id: number;
  name: string;
  users: User[];
}

@Entity("permission")
export class Permission implements PermissionModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @ManyToMany(() => User, (user) => user.permissions)
  users!: User[];

  public static async checkPermission(user: User, permission: Permissions) {
    if (!user.permissions || user.permissions.length === 0) {
      return false;
    }

    const userPermissions = user.permissions.map((v) => v.name);
    return userPermissions.includes(permission);
  }
}
