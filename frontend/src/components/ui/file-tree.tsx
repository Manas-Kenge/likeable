"use client"

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"

// React Icons imports
import { 
  SiTypescript, 
  SiJavascript, 
  SiReact, 
  SiHtml5, 
  SiCss3, 
  SiJson,
  SiMarkdown,
  SiPython,
  SiRuby,
  SiGo,
  SiRust,
} from "react-icons/si"
import { 
  VscFile, 
  VscFolder, 
  VscFolderOpened,
  VscSettingsGear,
  VscLock,
  VscFileMedia,
  VscTerminalBash,
} from "react-icons/vsc"
import type { IconType } from "react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

// Monokai color palette (matching the editor theme)
const monokaiColors = {
  background: '#272822',
  backgroundAlt: '#1e1f1c',
  foreground: '#f8f8f2',
  comment: '#75715e',
  red: '#f92672',
  orange: '#fd971f',
  yellow: '#e6db74',
  green: '#a6e22e',
  blue: '#66d9ef',
  purple: '#ae81ff',
  border: '#3e3d32',
  selection: '#49483e',
}

// File icon configuration
interface FileIconConfig {
  icon: IconType
  color: string
}

const getFileIcon = (filename: string): FileIconConfig => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const name = filename.toLowerCase()
  
  // Special file names
  if (name === 'package.json' || name === 'tsconfig.json' || name === 'vite.config.ts') {
    return { icon: VscSettingsGear, color: monokaiColors.comment }
  }
  if (name.includes('.lock') || name === 'yarn.lock' || name === 'package-lock.json') {
    return { icon: VscLock, color: monokaiColors.comment }
  }
  if (name.startsWith('.env')) {
    return { icon: VscSettingsGear, color: monokaiColors.yellow }
  }
  if (name === '.gitignore' || name === '.eslintrc' || name.includes('config')) {
    return { icon: VscSettingsGear, color: monokaiColors.comment }
  }
  
  // Extension-based icons
  const iconMap: Record<string, FileIconConfig> = {
    // TypeScript/JavaScript
    ts: { icon: SiTypescript, color: monokaiColors.blue },
    tsx: { icon: SiReact, color: monokaiColors.blue },
    js: { icon: SiJavascript, color: monokaiColors.yellow },
    jsx: { icon: SiReact, color: monokaiColors.blue },
    mjs: { icon: SiJavascript, color: monokaiColors.yellow },
    cjs: { icon: SiJavascript, color: monokaiColors.yellow },
    
    // Web
    html: { icon: SiHtml5, color: monokaiColors.orange },
    htm: { icon: SiHtml5, color: monokaiColors.orange },
    css: { icon: SiCss3, color: monokaiColors.blue },
    scss: { icon: SiCss3, color: monokaiColors.red },
    sass: { icon: SiCss3, color: monokaiColors.red },
    less: { icon: SiCss3, color: monokaiColors.blue },
    
    // Data
    json: { icon: SiJson, color: monokaiColors.yellow },
    yaml: { icon: VscSettingsGear, color: monokaiColors.red },
    yml: { icon: VscSettingsGear, color: monokaiColors.red },
    xml: { icon: VscFile, color: monokaiColors.orange },
    
    // Markdown
    md: { icon: SiMarkdown, color: monokaiColors.foreground },
    mdx: { icon: SiMarkdown, color: monokaiColors.blue },
    
    // Images
    svg: { icon: VscFileMedia, color: monokaiColors.yellow },
    png: { icon: VscFileMedia, color: monokaiColors.green },
    jpg: { icon: VscFileMedia, color: monokaiColors.green },
    jpeg: { icon: VscFileMedia, color: monokaiColors.green },
    gif: { icon: VscFileMedia, color: monokaiColors.purple },
    ico: { icon: VscFileMedia, color: monokaiColors.blue },
    webp: { icon: VscFileMedia, color: monokaiColors.green },
    
    // Other languages
    py: { icon: SiPython, color: monokaiColors.yellow },
    rb: { icon: SiRuby, color: monokaiColors.red },
    go: { icon: SiGo, color: monokaiColors.blue },
    rs: { icon: SiRust, color: monokaiColors.orange },
    java: { icon: VscFile, color: monokaiColors.orange },
    
    // Shell
    sh: { icon: VscTerminalBash, color: monokaiColors.green },
    bash: { icon: VscTerminalBash, color: monokaiColors.green },
    zsh: { icon: VscTerminalBash, color: monokaiColors.green },
    
    // Text
    txt: { icon: VscFile, color: monokaiColors.foreground },
    log: { icon: VscFile, color: monokaiColors.comment },
  }
  
  return iconMap[ext] || { icon: VscFile, color: monokaiColors.foreground }
}

// Folder color based on name
const getFolderColor = (folderName?: string): string => {
  if (!folderName) return monokaiColors.yellow
  
  const name = folderName.toLowerCase()
  const folderColors: Record<string, string> = {
    src: monokaiColors.blue,
    source: monokaiColors.blue,
    components: monokaiColors.green,
    ui: monokaiColors.purple,
    lib: monokaiColors.orange,
    libs: monokaiColors.orange,
    utils: monokaiColors.orange,
    util: monokaiColors.orange,
    helpers: monokaiColors.orange,
    hooks: monokaiColors.blue,
    hook: monokaiColors.blue,
    api: monokaiColors.red,
    apis: monokaiColors.red,
    services: monokaiColors.red,
    app: monokaiColors.green,
    pages: monokaiColors.green,
    views: monokaiColors.green,
    public: monokaiColors.yellow,
    static: monokaiColors.yellow,
    assets: monokaiColors.yellow,
    images: monokaiColors.green,
    img: monokaiColors.green,
    styles: monokaiColors.blue,
    css: monokaiColors.blue,
    types: monokaiColors.purple,
    interfaces: monokaiColors.purple,
    models: monokaiColors.purple,
    config: monokaiColors.comment,
    configs: monokaiColors.comment,
    test: monokaiColors.yellow,
    tests: monokaiColors.yellow,
    __tests__: monokaiColors.yellow,
    spec: monokaiColors.yellow,
    node_modules: monokaiColors.comment,
    dist: monokaiColors.comment,
    build: monokaiColors.comment,
    '.git': monokaiColors.comment,
    '.next': monokaiColors.comment,
    '.vscode': monokaiColors.blue,
  }
  
  return folderColors[name] || monokaiColors.yellow
}

// File Icon Component
interface FileTypeIconProps {
  filename: string
  className?: string
}

const FileTypeIcon = ({ filename, className }: FileTypeIconProps) => {
  const { icon: Icon, color } = getFileIcon(filename)
  return <Icon className={cn("size-4 flex-shrink-0", className)} style={{ color }} />
}

// Folder Icon Component
interface FolderTypeIconProps {
  isOpen: boolean
  folderName?: string
  className?: string
}

const FolderTypeIcon = ({ isOpen, folderName, className }: FolderTypeIconProps) => {
  const color = getFolderColor(folderName)
  const Icon = isOpen ? VscFolderOpened : VscFolder
  return <Icon className={cn("size-4 flex-shrink-0", className)} style={{ color }} />
}

type TreeViewElement = {
  id: string
  name: string
  isSelectable?: boolean
  children?: TreeViewElement[]
}

type TreeContextProps = {
  selectedId: string | undefined
  expandedItems: string[] | undefined
  indicator: boolean
  handleExpand: (id: string) => void
  selectItem: (id: string) => void
  setExpandedItems?: React.Dispatch<React.SetStateAction<string[] | undefined>>
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
  direction: "rtl" | "ltr"
}

const TreeContext = createContext<TreeContextProps | null>(null)

const useTree = () => {
  const context = useContext(TreeContext)
  if (!context) {
    throw new Error("useTree must be used within a TreeProvider")
  }
  return context
}

type Direction = "rtl" | "ltr" | undefined

type TreeViewProps = {
  initialSelectedId?: string
  indicator?: boolean
  elements?: TreeViewElement[]
  initialExpandedItems?: string[]
  openIcon?: React.ReactNode
  closeIcon?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

const Tree = forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      className,
      elements,
      initialSelectedId,
      initialExpandedItems,
      children,
      indicator = true,
      openIcon,
      closeIcon,
      dir,
      ...props
    },
    ref
  ) => {
    const [selectedId, setSelectedId] = useState<string | undefined>(
      initialSelectedId
    )
    const [expandedItems, setExpandedItems] = useState<string[] | undefined>(
      initialExpandedItems
    )

    const selectItem = useCallback((id: string) => {
      setSelectedId(id)
    }, [])

    const handleExpand = useCallback((id: string) => {
      setExpandedItems((prev) => {
        if (prev?.includes(id)) {
          return prev.filter((item) => item !== id)
        }
        return [...(prev ?? []), id]
      })
    }, [])

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return
        const findParent = (
          currentElement: TreeViewElement,
          currentPath: string[] = []
        ) => {
          const isSelectable = currentElement.isSelectable ?? true
          const newPath = [...currentPath, currentElement.id]
          if (currentElement.id === selectId) {
            if (isSelectable) {
              setExpandedItems((prev) => [...(prev ?? []), ...newPath])
            } else {
              if (newPath.includes(currentElement.id)) {
                newPath.pop()
                setExpandedItems((prev) => [...(prev ?? []), ...newPath])
              }
            }
            return
          }
          if (
            isSelectable &&
            currentElement.children &&
            currentElement.children.length > 0
          ) {
            currentElement.children.forEach((child) => {
              findParent(child, newPath)
            })
          }
        }
        elements.forEach((element) => {
          findParent(element)
        })
      },
      []
    )

    useEffect(() => {
      if (initialSelectedId) {
        expandSpecificTargetedElements(elements, initialSelectedId)
      }
    }, [initialSelectedId, elements])

    const direction = dir === "rtl" ? "rtl" : "ltr"

    return (
      <TreeContext.Provider
        value={{
          selectedId,
          expandedItems,
          handleExpand,
          selectItem,
          setExpandedItems,
          indicator,
          openIcon,
          closeIcon,
          direction,
        }}
      >
        <div 
          className={cn("size-full", className)}
          style={{ 
            backgroundColor: monokaiColors.backgroundAlt,
            color: monokaiColors.foreground,
          }}
        >
          <ScrollArea
            ref={ref}
            className="relative h-full px-2 py-2"
            dir={dir as Direction}
          >
            <AccordionPrimitive.Root
              {...props}
              type="multiple"
              defaultValue={expandedItems}
              value={expandedItems}
              className="flex flex-col gap-0.5"
              onValueChange={(value) =>
                setExpandedItems((prev) => [...(prev ?? []), value[0]])
              }
              dir={dir as Direction}
            >
              {children}
            </AccordionPrimitive.Root>
          </ScrollArea>
        </div>
      </TreeContext.Provider>
    )
  }
)

Tree.displayName = "Tree"

const TreeIndicator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { direction } = useTree()

  return (
    <div
      dir={direction}
      ref={ref}
      className={cn(
        "absolute left-1.5 h-full w-px rounded-md py-3 duration-300 ease-in-out rtl:right-1.5",
        className
      )}
      style={{ 
        backgroundColor: monokaiColors.border,
      }}
      {...props}
    />
  )
})

TreeIndicator.displayName = "TreeIndicator"

type FolderProps = {
  expandedItems?: string[]
  element: string
  isSelectable?: boolean
  isSelect?: boolean
} & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>

const Folder = forwardRef<
  HTMLDivElement,
  FolderProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      className,
      element,
      value,
      isSelectable = true,
      isSelect,
      children,
      ...props
    },
    ref
  ) => {
    const {
      direction,
      handleExpand,
      expandedItems,
      indicator,
      setExpandedItems,
      openIcon,
      closeIcon,
    } = useTree()

    const isExpanded = expandedItems?.includes(value)

    return (
      <AccordionPrimitive.Item
        {...props}
        value={value}
        className="relative h-full overflow-hidden"
      >
        <AccordionPrimitive.Trigger
          className={cn(
            "flex items-center gap-2 rounded-sm text-sm px-1.5 py-1 transition-colors w-full",
            className,
            {
              "cursor-pointer": isSelectable,
              "cursor-not-allowed opacity-50": !isSelectable,
            }
          )}
          style={{
            backgroundColor: isSelect && isSelectable ? monokaiColors.selection : 'transparent',
            color: monokaiColors.foreground,
          }}
          onMouseEnter={(e) => {
            if (isSelectable) {
              e.currentTarget.style.backgroundColor = monokaiColors.selection
            }
          }}
          onMouseLeave={(e) => {
            if (!(isSelect && isSelectable)) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
          disabled={!isSelectable}
          onClick={() => handleExpand(value)}
        >
          {openIcon && closeIcon ? (
            isExpanded ? openIcon : closeIcon
          ) : (
            <FolderTypeIcon isOpen={!!isExpanded} folderName={element} />
          )}
          <span className="truncate">{element}</span>
        </AccordionPrimitive.Trigger>
        <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down relative h-full overflow-hidden text-sm">
          {element && indicator && <TreeIndicator aria-hidden="true" />}
          <AccordionPrimitive.Root
            dir={direction}
            type="multiple"
            className="ml-4 flex flex-col gap-0.5 py-0.5 rtl:mr-4"
            defaultValue={expandedItems}
            value={expandedItems}
            onValueChange={(value) => {
              setExpandedItems?.((prev) => [...(prev ?? []), value[0]])
            }}
          >
            {children}
          </AccordionPrimitive.Root>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    )
  }
)

Folder.displayName = "Folder"

const File = forwardRef<
  HTMLButtonElement,
  {
    value: string
    handleSelect?: (id: string) => void
    isSelectable?: boolean
    isSelect?: boolean
    fileIcon?: React.ReactNode
    fileName?: string
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(
  (
    {
      value,
      className,
      handleSelect,
      isSelectable = true,
      isSelect,
      fileIcon,
      fileName,
      children,
      ...props
    },
    ref
  ) => {
    const { direction, selectedId, selectItem } = useTree()
    const isSelected = isSelect ?? selectedId === value
    
    // Extract filename from value or children for icon
    const displayName = fileName || (typeof children === 'string' ? children : value.split('/').pop() || value)
    
    return (
      <button
        ref={ref}
        type="button"
        disabled={!isSelectable}
        className={cn(
          "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-sm transition-colors",
          isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
          direction === "rtl" ? "rtl" : "ltr",
          className
        )}
        style={{
          backgroundColor: isSelected && isSelectable ? monokaiColors.selection : 'transparent',
          color: monokaiColors.foreground,
        }}
        onMouseEnter={(e) => {
          if (isSelectable) {
            e.currentTarget.style.backgroundColor = monokaiColors.selection
          }
        }}
        onMouseLeave={(e) => {
          if (!(isSelected && isSelectable)) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
        onClick={() => selectItem(value)}
        {...props}
      >
        {fileIcon ?? <FileTypeIcon filename={displayName} />}
        <span className="truncate">{children}</span>
      </button>
    )
  }
)

File.displayName = "File"

const CollapseButton = forwardRef<
  HTMLButtonElement,
  {
    elements: TreeViewElement[]
    expandAll?: boolean
  } & React.HTMLAttributes<HTMLButtonElement>
>(({ className, elements, expandAll = false, children, ...props }, ref) => {
  const { expandedItems, setExpandedItems } = useTree()

  const expendAllTree = useCallback((elements: TreeViewElement[]) => {
    const expandTree = (element: TreeViewElement) => {
      const isSelectable = element.isSelectable ?? true
      if (isSelectable && element.children && element.children.length > 0) {
        setExpandedItems?.((prev) => [...(prev ?? []), element.id])
        element.children.forEach(expandTree)
      }
    }

    elements.forEach(expandTree)
  }, [elements, setExpandedItems])

  const closeAll = useCallback(() => {
    setExpandedItems?.([])
  }, [setExpandedItems])

  useEffect(() => {
    if (expandAll) {
      expendAllTree(elements)
    }
  }, [expandAll, expendAllTree])

  return (
    <Button
      variant={"ghost"}
      className="absolute right-2 bottom-1 h-8 w-fit p-1"
      onClick={
        expandedItems && expandedItems.length > 0
          ? closeAll
          : () => expendAllTree(elements)
      }
      ref={ref}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle</span>
    </Button>
  )
})

CollapseButton.displayName = "CollapseButton"

export { CollapseButton, File, Folder, Tree, FileTypeIcon, FolderTypeIcon, monokaiColors, type TreeViewElement }
