# Cleanup Method in QueueManager Class

The `cleanup()` method in the `QueueManager` class should be called in the following scenarios:
1. **After Processing Tasks**: Call `cleanup()` after all tasks in the queue have been processed to free up resources and remove any completed tasks.
2. **On Application Shutdown**: Invoke `cleanup()` during the shutdown sequence of your application to ensure that any remaining tasks are finalized and resources are released properly.
3. **Error Handling**: If an error occurs during task processing, call `cleanup()` to reset the state and clear any partially processed tasks.
4. **Periodic Maintenance**: If your application runs continuously, consider calling `cleanup()` at regular intervals to manage memory and resource usage effectively.
5. **When Queue Size Exceeds a Limit**: If the queue grows too large, you might want to call `cleanup()` to remove old or completed tasks to maintain performance.