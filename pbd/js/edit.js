/*
 * edit.js
 * Bart Trzynadlowski, 2020
 *
 * EditOperation interface and concrete implementations. These handle editing
 * operations in the canvas window. A single given operation is active at any
 * given time.
 */


/*
 * EditOperation:
 *
 * All edit operations must implement this interface.
 */

function EditOperation()
{
}

EditOperation.prototype.Draw = function(ctx) {}
EditOperation.prototype.OnMouseMove = function(x, y) {}
EditOperation.prototype.OnMouseDown = function(x, y) {}
EditOperation.prototype.OnMouseUp = function(x, y) {}
EditOperation.prototype.Cancel = function() {}


/*
 * MoveVertexOperation:
 *
 * Allows vertices to be selected and moved by clicking and dragging.
 */

function MoveVertexOperation(physics)
{
  this.physics = physics;
  this.cursor = Vector3.Zero();
  this.highlightedVertex = null;
  this.isSelected = false;
}

MoveVertexOperation.prototype = new EditOperation();

MoveVertexOperation.prototype.Draw = function(ctx)
{
  // Draw highlighted vertex
  if (this.highlightedVertex)
  {
    var pos = this.highlightedVertex.Position();
    ctx.beginPath();
    ctx.arc(pos.x, ctx.canvas.height - pos.y, 4, 0, 360);
    ctx.fillStyle = "#88f";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

MoveVertexOperation.prototype.OnMouseMove = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);
  if (!this.isSelected)
  {
    this.highlightedVertex = this.physics.FindVertexAt(x, y);
  }
  else
  {
    // Update selected vertex position
    this.highlightedVertex.SetPosition(this.cursor);
    this.highlightedVertex.SetVelocity(Vector3.Zero());
  }
}

MoveVertexOperation.prototype.OnMouseDown = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);

  if (!this.isSelected)
  {
    var vertex = this.highlightedVertex;
    if (vertex)
    {
      // Clicked on a vertex
      this.isSelected = true;
    }
  }
}

MoveVertexOperation.prototype.OnMouseUp = function(x, y)
{
  this.Cancel();
}

MoveVertexOperation.prototype.Cancel = function()
{
  this.highlightedVertex = null;
  this.isSelected = false;
}


/*
 * CreateVertexOperation:
 *
 * Places vertices into a physics body.
 */

function CreateVertexOperation(body, fillColor)
{
  this.body = body;
  this.vertexMass = 1;
  this.fillColor = fillColor;
}

CreateVertexOperation.prototype = new EditOperation();

CreateVertexOperation.prototype.OnMouseDown = function(x, y)
{
  if (!this.body)
  {
    return;
  }

  var vertex = new Vertex(x, y, this.vertexMass);
  vertex.AddForce(0, -g_gravity * vertex.mass);
  vertex.fillColor = this.fillColor;
  this.body.AddVertex(vertex);
}


/*
 * CreateConstraintOperation:
 *
 * Adds distance constraints between any two vertices (which may exist on
 * different bodies) to the physics system.
 */

function CreateConstraintOperation(physics)
{
  this.physics = physics;
  this.k = 1;
  this.cursor = Vector3.Zero();
  this.highlightedVertex = null;
  this.vertex1 = null;
  this.vertex2 = null;

  this.FinalizeConstraint = function()
  {
    if (this.vertex1 == null || this.vertex2 == null)
    {
      return;
    }

    var constraint = new DistanceConstraint(this.k, this.vertex1, this.vertex2, Vector3.Distance(this.vertex1.Position(), this.vertex2.Position()));
    this.physics.AddConstraint(constraint);
    this.vertex1 = null;
    this.vertex2 = null;
  }
}

CreateConstraintOperation.prototype = new EditOperation();

CreateConstraintOperation.prototype.Draw = function(ctx)
{
  // Draw constraint in progress
  if (this.vertex1)
  {
    var from = this.vertex1.Position().Copy();
    var to = !this.vertex2 ? this.cursor.Copy() : this.vertex2.Position();
    from.y = ctx.canvas.height - from.y;
    to.y = ctx.canvas.height - to.y;
    var delta = Sub(to, from);
    var mag = delta.Magnitude();
    var dir = Mult(delta, 1.0 / mag);
    ctx.beginPath();
    ctx.moveTo(from.x + dir.x * 4, from.y + dir.y * 4);
    ctx.lineTo(to.x - dir.x * 4, to.y - dir.y * 4);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }

  // Draw highlighted vertex
  if (this.highlightedVertex)
  {
    var pos = this.highlightedVertex.Position();
    ctx.beginPath();
    ctx.arc(pos.x, ctx.canvas.height - pos.y, 4, 0, 360);
    ctx.fillStyle = "#88f";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

CreateConstraintOperation.prototype.OnMouseMove = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);
  this.highlightedVertex = this.physics.FindVertexAt(x, y);
}

CreateConstraintOperation.prototype.OnMouseDown = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);

  var vertex = this.highlightedVertex;
  if (vertex)
  {
    // Clicked on a vertex
    if (!this.vertex1)
    {
      // First vertex clicked on
      this.vertex1 = vertex;
      this.vertex2 = null;
    }
    else if (vertex == this.vertex1)
    {
      // Clicked on same vertex as the first one. Cancel operation.
      this.Cancel();
    }
    else
    {
      // Clicked on a second vertex. Finalize constraint.
      this.vertex2 = vertex;
      this.FinalizeConstraint();
    }
  }
  else
  {
    // Clicked on nothing or same endpoint. Cancel.
    this.Cancel();
  }
}

CreateConstraintOperation.prototype.Cancel = function()
{
  this.vertex1 = null;
  this.vertex2 = null;
}


/*
 * CreateAARectangleColliderOperation:
 *
 * Adds an AARectangleCollider to the physics system.
 */

function CreateAARectangleColliderOperation(physics)
{
  this.physics = physics;
  this.cursor = Vector3.Zero();
  this.corner1 = null;
  this.corner2 = null;

  this.FinalizeCollider = function()
  {
    if (this.corner1 == null || this.corner2 == null)
    {
      return;
    }

    var center = new Vector3(0.5 * (this.corner1.x + this.corner2.x), 0.5 * (this.corner1.y + this.corner2.y), 0);
    var width = Math.abs(this.corner1.x - this.corner2.x);
    var height = Math.abs(this.corner1.y - this.corner2.y);
    var collider = new AARectangleCollider(center, width, height);
    this.physics.AddCollider(collider);
    this.corner1 = null;
    this.corner2 = null;
  }
}

CreateAARectangleColliderOperation.prototype = new EditOperation();

CreateAARectangleColliderOperation.prototype.Draw = function(ctx)
{
  if (this.corner1)
  {
    // Note: rect() does not care about signs; no need to order corners
    var corner1 = this.corner1.Copy();
    var corner2 = !this.corner2 ? this.cursor.Copy() : this.corner2.Copy();
    ctx.beginPath();
    ctx.rect(corner1.x, ctx.canvas.height - corner1.y, corner2.x - corner1.x, corner1.y - corner2.y);
    ctx.fillStyle = "#e50";
    ctx.fill();
  }
}

CreateAARectangleColliderOperation.prototype.OnMouseMove = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);
}

CreateAARectangleColliderOperation.prototype.OnMouseDown = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);

  if (!this.corner1)
  {
    // First click
    this.corner1 = this.cursor.Copy();
    this.corner2 = null;
  }
  else
  {
    // Second click
    this.corner2 = this.cursor.Copy();
    this.FinalizeCollider();
  }
}

CreateAARectangleColliderOperation.prototype.Cancel = function()
{
  this.corner1 = null;
  this.corner2 = null;
}



/*
 * CreateCollisionProbeOperation:
 *
 * Creates a line segment that visualizes collider intersections.
 */

function CreateCollisionProbeOperation(physics)
{
  this.physics = physics;
  this.cursor = Vector3.Zero();
  this.from = null;
}

CreateCollisionProbeOperation.prototype = new EditOperation();

CreateCollisionProbeOperation.prototype.Draw = function(ctx)
{
  if (this.from)
  {
    var from = this.from.Copy();
    var to = this.cursor.Copy();
    from.y = ctx.canvas.height - from.y;
    to.y = ctx.canvas.height - to.y;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f00";
    ctx.stroke();

    // Perform collision tests
    for (let collider of this.physics.Colliders())
    {
      var result = collider.RayCast(this.from, this.cursor);
      if (result.intersected)
      {
        // Draw a blue normal from the intersection point
        var normalLength = 32;
        ctx.beginPath();
        ctx.moveTo(result.point.x, ctx.canvas.height - result.point.y);
        ctx.lineTo(result.point.x + normalLength * result.normal.x, ctx.canvas.height - (result.point.y + normalLength * result.normal.y));
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#00f";
        ctx.stroke();

        // Draw a green dot at intersection point
        ctx.beginPath();
        ctx.arc(result.point.x, ctx.canvas.height - result.point.y, 4, 0, 360);
        ctx.fillStyle = "#0f0";
        ctx.fill();
      }
    }
  }
}

CreateCollisionProbeOperation.prototype.OnMouseMove = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);
}

CreateCollisionProbeOperation.prototype.OnMouseDown = function(x, y)
{
  this.cursor = new Vector3(x, y, 0);

  if (!this.from)
  {
    // First click
    this.from = this.cursor.Copy();
  }
  else
  {
    // Second click
    this.from = null;
  }
}

CreateCollisionProbeOperation.prototype.Cancel = function()
{
  this.from = null;
}