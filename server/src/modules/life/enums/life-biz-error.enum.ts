import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Life 生活记事模块业务错误枚举（照片/音乐/随笔）
 * 码段：3000 ~ 3099
 */
export enum LifeBizError {
  /** 记录不存在 */
  NOT_FOUND = 3001,
  /** 文件格式不支持（仅允许 jpg/png/mp3 等） */
  UNSUPPORTED_MEDIA = 3002,
  /** 上传文件超出大小限制 */
  FILE_TOO_LARGE = 3003,
  /** 存储服务不可用（MinIO/OSS 连接失败） */
  STORAGE_UNAVAILABLE = 3004,
  /** 相册不存在 */
  ALBUM_NOT_FOUND = 3005,
}

const LIFE_ERROR_MSG: Record<LifeBizError, string> = {
  [LifeBizError.NOT_FOUND]: '记录不存在',
  [LifeBizError.UNSUPPORTED_MEDIA]: '不支持的文件格式',
  [LifeBizError.FILE_TOO_LARGE]: '文件超出大小限制',
  [LifeBizError.STORAGE_UNAVAILABLE]: '存储服务暂不可用',
  [LifeBizError.ALBUM_NOT_FOUND]: '相册不存在',
};

export function getLifeErrorInfo(err: LifeBizError): IErrorInfo {
  return {
    code: Number(err),
    message: LIFE_ERROR_MSG[err],
  };
}
