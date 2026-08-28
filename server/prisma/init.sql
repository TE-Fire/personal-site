-- ============================================================
-- personal_site 数据库初始化脚本
--
-- 适用：MySQL 8.0+
-- 当前项目进度：仅 auth 模块完成
--   · user 表（博主账号）
--   · 初始 admin 账号（密码 admin123 已 bcrypt 加密）
--
-- 后续模块（post / category / tag / comment ...）按需追加新 SQL
-- ============================================================

-- 1. 创建数据库
CREATE DATABASE IF NOT EXISTS `personal_site`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `personal_site`;

-- 2. 用户表（博主账号 · 个人博客唯一管理员）
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `username`   VARCHAR(50)  NOT NULL                       COMMENT '登录用户名',
  `password`   VARCHAR(100) NOT NULL                       COMMENT 'bcrypt 加密密码',
  `nickname`   VARCHAR(50)  DEFAULT NULL                    COMMENT '昵称',
  `email`      VARCHAR(100) DEFAULT NULL                    COMMENT '邮箱',
  `avatar`     VARCHAR(500) DEFAULT NULL                    COMMENT '头像URL',
  `role`       VARCHAR(20)  NOT NULL DEFAULT 'admin'        COMMENT '角色：admin / guest',
  `status`     TINYINT      NOT NULL DEFAULT 1              COMMENT '状态：1=正常 0=禁用',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                              COMMENT '创建时间',
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP
                                                              COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='博主账号表（个人博客唯一管理员）';

-- 3. 插入初始 admin 账号
--    密码：admin123
--    bcrypt hash（10 轮 salt）
INSERT INTO `user` (`id`, `username`, `password`, `nickname`, `email`, `avatar`, `role`, `status`)
VALUES (
  1,
  'admin',
  '$2b$10$2PCPakDhSjRaK5shG/GGdO9M4G85mhjw3WjRHsZZzl2LxESzmoTF.',
  'TE-Fire',
  'admin@example.com',
  NULL,
  'admin',
  1
);

-- 4. 验证
SELECT id, username, nickname, email, role, status, created_at
  FROM `user`;
