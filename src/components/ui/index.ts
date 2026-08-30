/**
 * UI 组件集中导出（Barrel）。
 * 消费端推荐写法：
 *   import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Label, Badge, Separator, Switch } from '@/components/ui'
 */
import Button from './Button.vue'
import Card, {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from './Card.vue'
import Input from './Input.vue'
import Label from './Label.vue'
import Badge from './Badge.vue'
import Separator from './Separator.vue'
import Switch from './Switch.vue'

export {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Badge,
  Separator,
  Switch,
}
