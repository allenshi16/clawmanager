package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"clawreef/internal/utils"

	"github.com/gin-gonic/gin"
)

// GetChatConfig returns WebSocket connection info for agent chat.
// The frontend uses this to connect directly to the OpenClaw agent's
// WebSocket, enabling full agent capabilities (skills, browser, memory).
func (h *InstanceHandler) GetChatConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "Invalid instance ID")
		return
	}

	instance, err := h.instanceService.GetByID(id)
	if err != nil || instance == nil {
		utils.Error(c, http.StatusNotFound, "Instance not found")
		return
	}

	userID, _ := c.Get("userID")
	userRole, _ := c.Get("userRole")
	if userRole != "admin" && instance.UserID != userID.(int) {
		utils.Error(c, http.StatusForbidden, "Access denied")
		return
	}

	if instance.Status != "running" {
		utils.Error(c, http.StatusBadRequest, "Instance is not running")
		return
	}

	accessURL := h.proxyService.GetProxyURLForInstance(instance, "")
	if accessURL == "" {
		utils.Error(c, http.StatusServiceUnavailable, "Unable to generate access URL")
		return
	}

	token, err := h.accessService.GenerateToken(
		userID.(int),
		instance.ID,
		instance.Type,
		accessURL,
		h.proxyService.GetTargetPortForInstance(instance),
		1*time.Hour,
	)
	if err != nil {
		utils.HandleError(c, err)
		return
	}

	gatewayPassword := h.getInstanceGatewayPassword(id)

	response := map[string]interface{}{
		"ws_path":          fmt.Sprintf("/api/v1/instances/%d/proxy/__openclaw__/ws", id),
		"access_token":     token.Token,
		"gateway_password": gatewayPassword,
	}

	utils.Success(c, http.StatusOK, "Chat config retrieved", response)
}

// getInstanceGatewayPassword reads the OpenClaw gateway password from the pod's
// openclaw.json config file via kubectl exec. Cached per instance for 5 minutes.
var gatewayPasswordCache = map[int]gatewayPasswordEntry{}

type gatewayPasswordEntry struct {
	password  string
	fetchedAt time.Time
}

func (h *InstanceHandler) getInstanceGatewayPassword(instanceID int) string {
	if entry, ok := gatewayPasswordCache[instanceID]; ok && time.Since(entry.fetchedAt) < 5*time.Minute {
		return entry.password
	}

	password := readGatewayPasswordFromPod(instanceID)
	if password != "" {
		gatewayPasswordCache[instanceID] = gatewayPasswordEntry{
			password:  password,
			fetchedAt: time.Now(),
		}
	}
	return password
}

func readGatewayPasswordFromPod(instanceID int) string {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "kubectl", "exec", "-n", "clawmanager-system",
		"-l", "app=openclaw-runtime", "--", "bash", "-c",
		fmt.Sprintf(`python3 -c "
import json, glob
files = glob.glob('/workspaces/openclaw/user-*/instance-%d/home/.openclaw/openclaw.json')
if files:
    d = json.load(open(files[0]))
    print(d.get('gateway',{}).get('auth',{}).get('password',''))
" 2>/dev/null`, instanceID))

	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}
