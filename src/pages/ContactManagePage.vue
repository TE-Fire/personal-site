<script setup lang="ts">
/**
 * ContactManagePage · 联系方式管理页（/admin/contact，requiresAuth）
 *
 * 管理员编辑对外展示的联系方式：
 *   · Email 渠道：邮箱地址 + 说明
 *   · GitHub 渠道：主页链接 + 展示文字 + 说明
 *   · 微信渠道：微信号 + 说明 + 二维码图片路径
 *
 * 数据流：
 *   onMounted → getContact() 拉数据 → 填充 draft
 *   保存     → updateContact(draft) → toast 反馈
 *
 * 风格参考 ProfilePage 编辑器：inline Label + Input 横排、Card 分区、页头 Save 按钮。
 */
import { onMounted, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import {
  getContact,
  updateContact,
  uploadContactQr,
  type ContactData,
  type UpdateContactParams,
} from '@/api/contact';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui';
import { Save, Mail, Github, Coffee, Loader2, ImagePlus, X, ZoomIn } from 'lucide-vue-next';

defineOptions({ name: 'ContactManagePage' });

const toast = useToast();

/* ---------- 加载 / 提交状态 ---------- */
const loading = ref(false);     // 初次加载
const submitting = ref(false);  // 保存中

/* ---------- 表单草稿（字段与 UpdateContactParams 对齐） ---------- */
function emptyDraft(): UpdateContactParams {
  return {
    contactEmail: '',
    contactEmailHint: '',
    contactGithubUrl: '',
    contactGithubLabel: '',
    contactGithubHint: '',
    contactWechatId: '',
    contactWechatQr: null,
    contactWechatHint: '',
  };
}

const draft = ref<UpdateContactParams>(emptyDraft());

/**
 * 把后端返回的 ContactData（按渠道聚合的 email/github/wechat 对象）
 * 拆解映射到表单使用的扁平 UpdateContactParams 字段。
 * 兼容后端偶尔直接返回扁平字段的情况（双写兜底）。
 */
function hydrateFromData(data: ContactData | UpdateContactParams | any) {
  const next = emptyDraft();
  // Email 渠道：value→contactEmail，hint→contactEmailHint
  const email = data?.email;
  if (email && typeof email === 'object') {
    next.contactEmail = email.value ?? '';
    next.contactEmailHint = email.hint ?? '';
  } else {
    next.contactEmail = data?.contactEmail ?? '';
    next.contactEmailHint = data?.contactEmailHint ?? '';
  }
  // GitHub 渠道：linkUrl→contactGithubUrl，linkText→contactGithubLabel，hint→contactGithubHint
  const github = data?.github;
  if (github && typeof github === 'object') {
    next.contactGithubUrl = github.linkUrl ?? '';
    next.contactGithubLabel = github.linkText ?? '';
    next.contactGithubHint = github.hint ?? '';
  } else {
    next.contactGithubUrl = data?.contactGithubUrl ?? '';
    next.contactGithubLabel = data?.contactGithubLabel ?? '';
    next.contactGithubHint = data?.contactGithubHint ?? '';
  }
  // 微信渠道：value→contactWechatId，hint→contactWechatHint，qrCode→contactWechatQr
  const wechat = data?.wechat;
  if (wechat && typeof wechat === 'object') {
    next.contactWechatId = wechat.value ?? '';
    next.contactWechatHint = wechat.hint ?? '';
    next.contactWechatQr = wechat.qrCode ?? null;
  } else {
    next.contactWechatId = data?.contactWechatId ?? '';
    next.contactWechatHint = data?.contactWechatHint ?? '';
    next.contactWechatQr = data?.contactWechatQr ?? null;
  }
  draft.value = next;
}

/* ---------- 初次加载 ---------- */
onMounted(async () => {
  loading.value = true;
  try {
    const data = await getContact();
    hydrateFromData(data);
  } catch (e: any) {
    toast.danger('加载失败', e?.message || '无法获取联系方式，请刷新重试');
  } finally {
    loading.value = false;
  }
});

/* ---------- 保存 ---------- */
async function handleSave() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const updated = await updateContact({ ...draft.value });
    // 保存成功后用服务端返回值回填，避免本地与服务端不一致
    if (updated) {
      hydrateFromData(updated);
    }
    toast.success('保存成功', '联系方式已同步到服务器');
  } catch (e: any) {
    toast.danger('保存失败', e?.message || '请稍后重试');
  } finally {
    submitting.value = false;
  }
}

/* ---------- 二维码上传 / 预览 ---------- */
const qrFileInputRef = ref<HTMLInputElement | null>(null);
const uploadingQr = ref(false);
const qrPreviewOpen = ref(false);

// 触发隐藏的 file input
function pickQrFile() {
  if (uploadingQr.value) return;
  qrFileInputRef.value?.click();
}

// file input change 事件：取出文件后立即重置 value 以便重复选择同一文件
function onQrFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) uploadQr(file);
}

// 调用上传接口，成功后写入表单字段
async function uploadQr(file: File) {
  uploadingQr.value = true;
  try {
    const url = await uploadContactQr(file);
    draft.value.contactWechatQr = url;
    toast.success('上传成功', file.name);
  } catch (e: any) {
    toast.danger('上传失败', e?.message || '请稍后重试');
  } finally {
    uploadingQr.value = false;
  }
}

// 清除二维码（仅清空本地表单值，需点保存才生效到服务端）
function clearQr() {
  if (uploadingQr.value) return;
  draft.value.contactWechatQr = null;
}
</script>

<template>
  <article class="max-w-3xl mx-auto space-y-6">
    <!-- ==================== 页头 ==================== -->
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ admin / contact</p>
        <h1 class="m-0 text-2xl md:text-3xl font-semibold tracking-tight">联系方式管理</h1>
        <p class="m-0 text-sm text-text-muted">
          编辑对外展示的邮箱、GitHub、微信渠道信息，保存后立即生效。
        </p>
      </div>
      <Button
        type="button"
        :disabled="loading || submitting"
        class="h-9 px-4 shadow hover:shadow-md transition-shadow"
        @click="handleSave"
      >
        <Loader2 v-if="submitting" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        <span>{{ submitting ? '保存中…' : '保存' }}</span>
      </Button>
    </header>

    <!-- ==================== 加载中 ==================== -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-text-muted">
      <Loader2 class="size-5 animate-spin" />
      <span class="text-sm">正在加载…</span>
    </div>

    <!-- ==================== 编辑表单 ==================== -->
    <template v-else>
      <!-- Email 区块 -->
      <Card>
        <CardHeader class="flex flex-row items-center gap-3 pb-2">
          <span class="inline-flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Mail class="size-[18px]" />
          </span>
          <CardTitle class="text-base">Email 邮箱</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4 pt-2">
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">邮箱地址</Label>
            <Input
              v-model="draft.contactEmail"
              type="email"
              placeholder="例：hello@example.com"
              class="flex-1"
            />
          </div>
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">邮箱说明</Label>
            <Input
              v-model="draft.contactEmailHint"
              maxlength="120"
              placeholder="展示在邮箱下方的提示文字，如「工作日 24h 内回复」"
              class="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      <!-- GitHub 区块 -->
      <Card>
        <CardHeader class="flex flex-row items-center gap-3 pb-2">
          <span class="inline-flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Github class="size-[18px]" />
          </span>
          <CardTitle class="text-base">GitHub</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4 pt-2">
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">主页链接</Label>
            <Input
              v-model="draft.contactGithubUrl"
              placeholder="例：https://github.com/yourname"
              class="flex-1"
            />
          </div>
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">展示文字</Label>
            <Input
              v-model="draft.contactGithubLabel"
              maxlength="40"
              placeholder="按钮上显示的文字，如「@yourname」"
              class="flex-1"
            />
          </div>
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">说明</Label>
            <Input
              v-model="draft.contactGithubHint"
              maxlength="120"
              placeholder="展示在 GitHub 下的提示文字"
              class="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      <!-- 微信区块 -->
      <Card>
        <CardHeader class="flex flex-row items-center gap-3 pb-2">
          <span class="inline-flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Coffee class="size-[18px]" />
          </span>
          <CardTitle class="text-base">微信</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4 pt-2">
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">微信号</Label>
            <Input
              v-model="draft.contactWechatId"
              maxlength="60"
              placeholder="对外展示的微信号"
              class="flex-1"
            />
          </div>
          <div class="flex items-center gap-4 py-1">
            <Label class="w-28 shrink-0 text-sm font-medium text-text">说明</Label>
            <Input
              v-model="draft.contactWechatHint"
              maxlength="120"
              placeholder="展示在微信下的提示文字，如「加我请备注来意」"
              class="flex-1"
            />
          </div>
          <div class="flex items-start gap-4 py-1">
            <Label class="w-28 shrink-0 pt-1 text-sm font-medium text-text">二维码</Label>
            <div class="flex-1 space-y-2">
              <!-- 隐藏的文件选择 input -->
              <input
                ref="qrFileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onQrFileChange"
              />

              <!-- 已有二维码：预览 + 更换 + 清除 -->
              <div v-if="draft.contactWechatQr" class="flex items-start gap-4">
                <button
                  type="button"
                  class="group relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface p-1 transition hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand"
                  @click="qrPreviewOpen = true"
                >
                  <img
                    :src="draft.contactWechatQr"
                    alt="微信二维码"
                    class="block size-28 object-contain rounded-lg"
                  />
                  <span class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition group-hover:bg-black/5">
                    <ZoomIn class="size-6 text-text opacity-0 transition group-hover:opacity-100" />
                  </span>
                </button>
                <div class="flex flex-col gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    :disabled="uploadingQr"
                    @click="pickQrFile"
                  >
                    <Loader2 v-if="uploadingQr" class="size-4 animate-spin" />
                    <ImagePlus v-else class="size-4" />
                    <span>{{ uploadingQr ? '上传中…' : '更换二维码' }}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    :disabled="uploadingQr"
                    @click="clearQr"
                  >
                    <X class="size-4" />
                    <span>清除</span>
                  </Button>
                </div>

                <!-- 二维码放大预览（编辑页） -->
                <Dialog v-model:open="qrPreviewOpen">
                  <DialogContent class="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>微信二维码预览</DialogTitle>
                      <DialogDescription>保存前可点击放大查看实际效果</DialogDescription>
                    </DialogHeader>
                    <div class="flex justify-center py-2">
                      <img
                        :src="draft.contactWechatQr"
                        alt="微信二维码"
                        class="max-h-72 w-auto rounded-xl border border-border object-contain"
                      />
                    </div>
                    <div class="mt-4 flex justify-end">
                      <DialogClose as-child>
                        <Button type="button" variant="outline" size="sm">关闭</Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <!-- 无二维码：虚线上传区域 -->
              <button
                v-else
                type="button"
                :disabled="uploadingQr"
                class="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/50 text-text-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
                @click="pickQrFile"
              >
                <Loader2 v-if="uploadingQr" class="size-6 animate-spin" />
                <ImagePlus v-else class="size-6" />
                <span class="text-sm">{{ uploadingQr ? '上传中…' : '上传二维码' }}</span>
              </button>

              <p class="m-0 text-xs text-text-muted">
                支持 jpg / png 等图片格式，上传后将作为微信渠道的二维码展示。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </article>
</template>
