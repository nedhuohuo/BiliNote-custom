import { useEffect, useRef } from 'react'
import { Task, useTaskStore } from '@/store/taskStore'
import { get_task_status } from '@/services/note.ts'
import toast from 'react-hot-toast'

type TaskUpdate = Partial<Pick<Task, 'status' | 'partialMarkdown'>>

export const useTaskPolling = (interval = 1000) => {
  const tasks = useTaskStore(state => state.tasks)
  const updateTaskContent = useTaskStore(state => state.updateTaskContent)

  const tasksRef = useRef(tasks)

  // 每次 tasks 更新，把最新的 tasks 同步进去
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    const timer = setInterval(async () => {
      const pendingTasks = tasksRef.current.filter(
        task => task.status != 'SUCCESS' && task.status != 'FAILED'
      )

      // 无活跃任务时跳过轮询
      if (pendingTasks.length === 0) return

      for (const task of pendingTasks) {
        try {
          const res = await get_task_status(task.id)
          const { status } = res
          const partialMarkdown = typeof res.partial_markdown === 'string' ? res.partial_markdown : undefined

          if (status === 'SUCCESS') {
            const { markdown, transcript, audio_meta } = res.result
            toast.success('笔记生成成功')
            updateTaskContent(task.id, {
              status,
              markdown,
              transcript,
              audioMeta: audio_meta,
              partialMarkdown: '',
            })
          } else if (status === 'FAILED') {
            updateTaskContent(task.id, { status })
            console.warn(`⚠️ 任务 ${task.id} 失败`)
          } else if (status) {
            const nextData: TaskUpdate = status !== task.status ? { status } : {}
            if (partialMarkdown !== undefined && partialMarkdown !== task.partialMarkdown) {
              nextData.partialMarkdown = partialMarkdown
            }
            if (Object.keys(nextData).length > 0) {
              updateTaskContent(task.id, nextData)
            }
          }

        } catch (e) {
          console.error('❌ 任务轮询失败：', e)
          updateTaskContent(task.id, { status: 'FAILED' })
        }
      }
    }, interval)

    return () => clearInterval(timer)
  }, [interval])
}
