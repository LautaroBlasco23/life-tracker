package controller

import (
	"errors"
	"net/http"
	"strconv"

	"life-tracker-backend/internal/domain/note-group/dto"
	"life-tracker-backend/internal/domain/note-group/service"

	"github.com/gin-gonic/gin"
)

type NoteGroupController struct {
	service *service.NoteGroupService
}

func NewNoteGroupController(service *service.NoteGroupService) *NoteGroupController {
	return &NoteGroupController{service: service}
}

func (c *NoteGroupController) CreateNoteGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var req dto.CreateNoteGroupRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	group, err := c.service.CreateNoteGroup(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create note group"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Note group created successfully",
		"data":    group,
	})
}

func (c *NoteGroupController) GetNoteGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid note group ID"})
		return
	}

	group, err := c.service.GetNoteGroup(uint(id), userID)
	if err != nil {
		if errors.Is(err, service.ErrNoteGroupNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "Note group not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch note group"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Note group retrieved successfully",
		"data":    group,
	})
}

func (c *NoteGroupController) GetNoteGroups(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	groups, err := c.service.GetNoteGroups(userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch note groups"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Note groups retrieved successfully",
		"data":    groups,
		"count":   len(groups),
	})
}

func (c *NoteGroupController) UpdateNoteGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid note group ID"})
		return
	}

	var req dto.UpdateNoteGroupRequest
	if err = ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	group, err := c.service.UpdateNoteGroup(uint(id), userID, &req)
	if err != nil {
		if errors.Is(err, service.ErrNoteGroupNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "Note group not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update note group"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Note group updated successfully",
		"data":    group,
	})
}

func (c *NoteGroupController) ReorderNoteGroups(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var req dto.ReorderNoteGroupsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if err := c.service.ReorderNoteGroups(userID, &req); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to reorder note groups"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Note groups reordered successfully"})
}

func (c *NoteGroupController) DeleteNoteGroup(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid note group ID"})
		return
	}

	if err := c.service.DeleteNoteGroup(uint(id), userID); err != nil {
		if errors.Is(err, service.ErrNoteGroupNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "Note group not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete note group"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Note group deleted successfully"})
}
