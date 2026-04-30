import { Button, View } from '@tarojs/components'
import { cn } from '@/lib/utils'

interface ShareButtonProps {
  className?: string
  children?: React.ReactNode
}

export function ShareButton({ className, children }: ShareButtonProps) {
  return (
    <View className={cn('relative', className)}>
      <Button
        openType="share"
        className="absolute inset-0 opacity-0 z-10"
      />
      {children}
    </View>
  )
}
