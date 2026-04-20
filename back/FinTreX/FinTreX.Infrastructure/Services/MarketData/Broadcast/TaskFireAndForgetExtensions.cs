using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services.MarketData.Broadcast
{
    internal static class TaskFireAndForgetExtensions
    {
        public static void SafeFireAndForget(this Task task, ILogger logger, string operationName)
        {
            if (task is null)
            {
                return;
            }

            if (task.IsCompleted)
            {
                ObserveCompletedTask(task, logger, operationName);
                return;
            }

            _ = ObserveAsync(task, logger, operationName);
        }

        private static void ObserveCompletedTask(Task task, ILogger logger, string operationName)
        {
            if (!task.IsFaulted || task.Exception is null)
            {
                return;
            }

            logger.LogWarning(
                task.Exception.GetBaseException(),
                "Background market-data task failed: {Operation}",
                operationName);
        }

        private static async Task ObserveAsync(Task task, ILogger logger, string operationName)
        {
            try
            {
                await task.ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                // Ignore cancellation; stream shutdown or client disconnect can trigger this.
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Background market-data task failed: {Operation}", operationName);
            }
        }
    }
}
