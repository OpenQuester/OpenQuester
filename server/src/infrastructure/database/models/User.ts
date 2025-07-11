import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

import { Container, CONTAINER_TYPES } from "application/Container";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { UserModel } from "domain/types/user/UserModel";
import { File } from "infrastructure/database/models/File";
import { Package } from "infrastructure/database/models/package/Package";
import { Permission } from "infrastructure/database/models/Permission";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

@Entity("user")
@Unique(["email", "username", "discord_id"])
export class User implements UserModel {
  constructor() {
    //
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true, nullable: false })
  username!: string;

  @Column({ type: "varchar", unique: true, nullable: true })
  email?: string | null;

  @Column({ type: "varchar", unique: true, nullable: true })
  discord_id?: string | null;

  @Column({ type: "date", nullable: true })
  birthday?: Date | null;

  @OneToOne(() => File, { nullable: true })
  @JoinColumn({ name: "avatar" })
  avatar?: File | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column()
  is_deleted!: boolean;

  @OneToMany(() => Package, (packageEntity) => packageEntity.author)
  packages!: Package[];

  @ManyToMany(() => Permission, (permission) => permission.users)
  @JoinTable({
    name: "user_permissions",
    joinColumn: { name: "user_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "permission_id", referencedColumnName: "id" },
  })
  permissions!: Permission[];

  public import(data: UserModel) {
    if (data.id) {
      this.id = data.id;
    }
    this.username = data.username;
    this.email = data.email;
    this.discord_id = data.discord_id ?? null;
    this.birthday = data.birthday;
    this.avatar = data.avatar;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.is_deleted = data.is_deleted;
    this.permissions = data.permissions ?? this.permissions ?? [];
  }

  public toDTO(): UserDTO {
    const storage = Container.get<S3StorageService>(
      CONTAINER_TYPES.S3StorageService
    );

    const avatarLink = this.avatar
      ? storage.getUrl(this.avatar.filename)
      : null;

    return {
      id: this.id,
      username: this.username,
      email: this.email,
      birthday: this.birthday,
      discordId: this.discord_id,
      avatar: avatarLink,
      permissions: this.permissions,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      isDeleted: this.is_deleted,
    };
  }
}
