/**
 * data barrel · 全站所有 Mock 数据集中出口。
 * 推荐消费端：`import { aboutMe, skillGroups, projects, posts, timelineNodes, contactChannels } from '@/data'`
 */
export { aboutMe, skillGroups, type AboutMe, type SkillGroup } from './about'
export {
  projects,
  listProjectTags,
  projectCategories,
  type Project,
  type ProjectCategory
} from './projects'
export {
  posts,
  readingMinutes,
  postArticleCategories,
  listPostTags,
  type BlogPost,
  type PostArticleCategory,
  type PostCategory
} from './posts'
export {
  timelineNodes,
  nodeKindMeta,
  type TimelineNode,
  type TimelineNodeKind
} from './timeline'
export {
  contactChannels,
  validateContactForm,
  type ContactChannel,
  type ContactFormField,
  type ContactFormErrors
} from './contact'
export {
  photoMoments,
  musicMoments,
  essayMoments,
  allMoments,
  getMomentsSorted,
  getMonths,
  moodEmoji,
  type LifeMoment,
  type PhotoMoment,
  type MusicMoment,
  type EssayMoment,
  type MomentType,
  type Mood
} from './life'
