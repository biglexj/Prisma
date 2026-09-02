import React, { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { useRenamer } from "../hooks/useRenamer";
import { RenamerToolbar } from "./RenamerToolbar";
import { RuleStepCard } from "./RuleStepCard";
import { AddRuleModal } from "./AddRuleModal";
import { FilePreviewTable } from "./FilePreviewTable";
import type { RuleType } from "../model/types";
import "./batch-renamer.css";

export function BatchRenamerView() {
  const {
    currentFolder,
    items,
    previewItems,
    filteredPreviewItems,
    steps,
    filterMode,
    customExtensions,
    includeSubfolders,
    targetType,
    selectedPaths,
    searchQuery,
    isScanning,
    isExecuting,
    canUndo,
    isDraggingOver,
    lastResult,
    error,
    totalCount,
    selectedCount,
    readyCount,
    conflictCount,
    invalidCount,
    setSearchQuery,
    setCustomExtensions,
    pickFolder,
    loadFolder,
    refreshFolder,
    handleFilterChange,
    handleSubfoldersToggle,
    handleTargetTypeChange,
    addStep,
    updateStep,
    toggleStep,
    removeStep,
    moveStep,
    loadPreset,
    toggleSelectAll,
    toggleSelectItem,
    executeRename,
    executeUndo,
    clearError,
    clearResult,
  } = useRenamer();

  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);

  const handleSelectRuleType = (type: RuleType) => {
    addStep(type);
  };

  return (
    <div className={`batch-renamer-root ${isDraggingOver ? "is-drag-over" : ""}`}>
      {/* Overlay Drag & Drop */}
      {isDraggingOver && (
        <div className="renamer-drop-overlay">
          <div className="renamer-drop-card">
            <div className="renamer-drop-pulse">
              <Icon name="folder-open" />
            </div>
            <h3>Suelta tu carpeta aquí</h3>
            <p>Se cargarán y prepararán todos los archivos para el renombrado por lotes</p>
          </div>
        </div>
      )}

      {/* Cabecera Principal */}
      <header className="batch-renamer-header">
        <div className="renamer-title-area">
          <div className="renamer-title-row">
            <span className="renamer-header-badge-icon">
              <Icon name="edit" />
            </span>
            <div>
              <h1>Renombrador por Lotes</h1>
              <p>Encadena reglas modulares, previsualiza cambios en vivo y renombra con seguridad total</p>
            </div>
          </div>
        </div>

        {canUndo && (
          <button
            type="button"
            className="renamer-undo-top-btn"
            onClick={executeUndo}
            disabled={isExecuting}
            title="Revertir el último renombrado realizado"
          >
            <Icon name="undo" />
            <span>Deshacer Último Renombrado</span>
          </button>
        )}
      </header>

      {/* Notificaciones y Alertas */}
      {error && (
        <div className="renamer-alert is-danger" role="alert">
          <Icon name="close" />
          <div className="renamer-alert-content">
            <strong>Error en operación:</strong> {error}
          </div>
          <button type="button" className="renamer-alert-close" onClick={clearError} aria-label="Cerrar error">
            <Icon name="close" />
          </button>
        </div>
      )}

      {lastResult && (
        <div className={`renamer-alert ${lastResult.errors.length > 0 ? "is-warning" : "is-success"}`} role="status">
          <Icon name={lastResult.errors.length > 0 ? "info" : "check"} />
          <div className="renamer-alert-content">
            <strong>{lastResult.renamedCount > 0 ? `¡Operación completada! ${lastResult.renamedCount} archivo(s) renombrados exitosamente.` : "Operación procesada."}</strong>
            {lastResult.errors.length > 0 && (
              <span className="renamer-alert-sub">{lastResult.errors.join("; ")}</span>
            )}
          </div>
          <button type="button" className="renamer-alert-close" onClick={clearResult} aria-label="Cerrar notificación">
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* Barra de Herramientas y Filtros */}
      <RenamerToolbar
        currentFolder={currentFolder}
        filterMode={filterMode}
        customExtensions={customExtensions}
        includeSubfolders={includeSubfolders}
        targetType={targetType}
        isScanning={isScanning}
        onPickFolder={pickFolder}
        onRefresh={refreshFolder}
        onFilterChange={handleFilterChange}
        onCustomExtensionsChange={setCustomExtensions}
        onSubfoldersToggle={handleSubfoldersToggle}
        onTargetTypeChange={handleTargetTypeChange}
        onLoadPreset={loadPreset}
      />

      {/* Panel Dividido: Reglas a la izquierda | Previsualización a la derecha */}
      <main className="batch-renamer-split-body">
        {/* Panel Izquierdo: Lista de Reglas / Pasos */}
        <aside className="renamer-steps-sidebar">
          <div className="renamer-steps-header">
            <div className="renamer-steps-title-group">
              <strong>Pasos de Renombrado</strong>
              <span className="renamer-steps-badge">{steps.length}</span>
            </div>
            <button
              type="button"
              className="renamer-add-step-btn"
              onClick={() => setIsAddRuleOpen(true)}
              title="Añadir nueva regla de transformación"
            >
              <Icon name="plus" />
              <span>Añadir Paso</span>
            </button>
          </div>

          <div className="renamer-steps-scroll">
            {steps.length === 0 ? (
              <div className="renamer-steps-empty">
                <Icon name="sliders" />
                <p>No hay pasos activos</p>
                <button
                  type="button"
                  className="renamer-add-step-btn is-centered"
                  onClick={() => setIsAddRuleOpen(true)}
                >
                  <Icon name="plus" />
                  <span>Añadir Primera Regla</span>
                </button>
              </div>
            ) : (
              steps.map((step, idx) => (
                <RuleStepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  totalSteps={steps.length}
                  onUpdate={updateStep}
                  onToggle={toggleStep}
                  onRemove={removeStep}
                  onMove={moveStep}
                />
              ))
            )}
          </div>
        </aside>

        {/* Panel Derecho: Tabla de Previsualización en Vivo */}
        <section className="renamer-preview-panel">
          <FilePreviewTable
            items={filteredPreviewItems}
            totalCount={totalCount}
            selectedCount={selectedCount}
            searchQuery={searchQuery}
            isScanning={isScanning}
            onSearchChange={setSearchQuery}
            onToggleSelectAll={toggleSelectAll}
            onToggleItem={toggleSelectItem}
          />
        </section>
      </main>

      {/* Barra de Acciones Inferior */}
      <footer className="batch-renamer-footer">
        <div className="renamer-footer-summary">
          <span className="summary-pill is-total">
            Total: <strong>{totalCount}</strong>
          </span>
          <span className="summary-pill is-ready">
            Listos: <strong>{readyCount}</strong>
          </span>
          {conflictCount > 0 && (
            <span className="summary-pill is-conflict" title="Archivos que causarían nombres duplicados">
              <Icon name="close" /> Conflictos: <strong>{conflictCount}</strong>
            </span>
          )}
          {invalidCount > 0 && (
            <span className="summary-pill is-invalid" title="Archivos con caracteres inválidos">
              <Icon name="close" /> Inválidos: <strong>{invalidCount}</strong>
            </span>
          )}
        </div>

        <div className="renamer-footer-actions">
          {canUndo && (
            <button
              type="button"
              className="renamer-undo-bottom-btn"
              onClick={executeUndo}
              disabled={isExecuting}
            >
              <Icon name="undo" />
              <span>Deshacer</span>
            </button>
          )}

          <button
            type="button"
            className="renamer-execute-btn"
            disabled={readyCount === 0 || conflictCount > 0 || invalidCount > 0 || isExecuting}
            onClick={executeRename}
          >
            <Icon name={isExecuting ? "refresh" : "check"} className={isExecuting ? "is-spinning" : ""} />
            <span>
              {isExecuting
                ? "Renombrando..."
                : readyCount > 0
                ? `Renombrar ${readyCount} Archivo(s)`
                : "Sin cambios pendientes"}
            </span>
          </button>
        </div>
      </footer>

      {/* Modal para Seleccionar Tipo de Regla */}
      <AddRuleModal
        isOpen={isAddRuleOpen}
        onClose={() => setIsAddRuleOpen(false)}
        onSelectType={handleSelectRuleType}
      />
    </div>
  );
}
