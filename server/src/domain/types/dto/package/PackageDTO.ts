import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { PackageRoundDTO } from "domain/types/dto/package/PackageRoundDTO";
import { PackageTagDTO } from "domain/types/dto/package/PackageTagDTO";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";
import { PackageStatus } from "domain/enums/package/PackageStatus";

export interface PackageDTO {
  id?: number;
  title: string;
  description?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  status?: PackageStatus;
  roundsCount?: number;
  questionsCount?: number;
  author: ShortUserInfo;
  ageRestriction: AgeRestriction;
  language?: string | null;
  logo?: { file: PackageFileDTO } | null;
  rounds: PackageRoundDTO[];
  tags: PackageTagDTO[];
}
