import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { PackageRoundDTO } from "domain/types/dto/package/PackageRoundDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type IFileUrlBuilder } from "domain/types/storage/IFileUrlBuilder";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageTheme } from "infrastructure/database/models/package/PackageTheme";

export interface PackageRoundImport {
  name: string;
  description?: string | null;
  package: Package;
  order: number;
  type: PackageRoundType;
}

@Entity("package_round")
export class PackageRound {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Package, (pkg) => pkg.rounds, { onDelete: "CASCADE" })
  @JoinColumn({ name: "package" })
  package!: Package;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @OneToMany(() => PackageTheme, (theme: PackageTheme) => theme.round)
  themes!: PackageTheme[];

  @Column({ type: "int" })
  order!: number;

  @Column({
    type: "enum",
    enum: [...Object.values(PackageRoundType)],
    default: "simple"
  })
  type!: PackageRoundType;

  public import(data: PackageRoundImport): void {
    this.name = data.name;
    this.description = data.description;
    this.package = data.package;
    this.order = data.order;
    this.type = data.type;
  }

  public toDTO(fileUrlBuilder: IFileUrlBuilder, opts: PackageDTOOptions): PackageRoundDTO {
    if (this.themes.length < 1) {
      throw new ClientError(ClientResponse.PACKAGE_CORRUPTED, undefined, {
        id: this.id,
        missing: "themes"
      });
    }

    const themesDTO = this.themes.map((theme) => theme.toDTO(fileUrlBuilder, opts));

    let dto: PackageRoundDTO = {
      name: this.name,
      description: this.description,
      themes: themesDTO,
      order: this.order,
      type: this.type
    };

    if (opts.fetchIds) {
      dto = {
        id: this.id,
        ...dto
      };
    }

    return dto;
  }
}
