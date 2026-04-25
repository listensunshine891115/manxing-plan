import * as React from "react"
import { Input as TaroInput, View } from "@tarojs/components"
import { cn } from "@/lib/utils"

export interface InputProps {
  className?: string
  type?: string
  autoFocus?: boolean
  min?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  focus?: boolean
  onFocus?: (e: any) => void
  onBlur?: (e: any) => void
  onInput?: (e: any) => void
  onChange?: (e: any) => void
  onConfirm?: () => void
  [key: string]: any
}

const Input = React.forwardRef<any, InputProps>(
  (props, ref) => {
    const { className, type, autoFocus, focus, onFocus, onBlur, onChange, onInput, min, value, placeholder, disabled, ...rest } = props
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => {
      if (autoFocus || focus) setIsFocused(true)
    }, [autoFocus, focus])

    // date/time 类型使用原生样式，不添加额外包装
    const isDateTimeType = type === 'date' || type === 'time' || type === 'datetime-local'

    // 日期时间类型直接返回 TaroInput，不添加额外包装
    if (isDateTimeType) {
      const dateTimeProps: any = {
        type,
        className: className || "w-full bg-transparent text-sm",
        ref,
        value,
        placeholder,
        disabled,
        focus,
        onFocus,
        onBlur,
        onInput,
        min,
        ...rest,
      }
      if (onChange) dateTimeProps.onChange = onChange
      return <TaroInput {...dateTimeProps} />
    }

    // 构建传递给 TaroInput 的属性
    const inputProps: any = {
      type,
      className: "w-full flex-1 bg-transparent text-sm text-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 selection:bg-selection selection:text-selection-foreground",
      placeholderClass: "text-muted-foreground",
      ref,
      focus: autoFocus || focus,
      value,
      placeholder,
      disabled,
      onFocus: (e: any) => {
        setIsFocused(true)
        onFocus?.(e)
      },
      onBlur: (e: any) => {
        setIsFocused(false)
        onBlur?.(e)
      },
      onInput,
      ...rest,
    }
    
    // 添加 onChange 支持
    if (onChange) {
      inputProps.onChange = onChange
    }

    return (
      <View
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:border-ring focus-within:ring-4 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          isFocused &&
            "border-ring ring-4 ring-ring ring-offset-2 ring-offset-background",
          className
        )}
        onTouchStart={() => {
          if (disabled) return
          setIsFocused(true)
        }}
      >
        <TaroInput {...inputProps} />
      </View>
    )
  }
)
Input.displayName = "Input"

export { Input }
